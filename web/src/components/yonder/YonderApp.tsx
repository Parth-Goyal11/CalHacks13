"use client";

/* eslint-disable @next/next/no-img-element -- Figma photographs and local Blob URLs share fixed photo slots. */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import BottomNav from "./Navigation";
import MemoriesScreen from "./MemoriesScreen";
import CameraFlow from "./CameraFlow";
import Discovery from "./Discovery";
import { IconButton, SkyIcon } from "./SkyIcon";
import { IMG, friendPosts, type SkyPhoto, type Tab } from "./sky-data";
import { identificationLabel, type SkyPhotoResult } from "./analysis";
import { objectsFromResult, learningFor } from "./photo-discoveries";
import { revealObjects } from "./reveal-analysis";
import {
  readMemories,
  writeMemory,
  removeMemory,
  type StoredMemory,
} from "./memory-store";
import {
  LocationSheet,
  conditionLabel,
  coordinateLabel,
  useSkyWeather,
} from "./SkyLocation";
import type { Place, CurrentWeather } from "./tonight-data";

type LocalProfile = {
  name: string;
  handle: string;
  bio: string;
  school: string;
  sign: string;
};
const defaultProfile: LocalProfile = {
  name: "You",
  handle: "your-sky",
  bio: "A little closer to the night.",
  school: "",
  sign: "",
};

function subscribeNavigation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("yonder:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("yonder:navigate", callback);
  };
}
function tabSnapshot(): Tab {
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "explore" || value === "memories" || value === "profile"
    ? value
    : window.location.pathname === "/my-sky"
      ? "memories"
      : "home";
}
function objectsFor(result: SkyPhotoResult) {
  if (result.reveal) return revealObjects(result.reveal);
  return objectsFromResult(result).map((object) => ({
    ...object,
    detail: learningFor(object).body,
  }));
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function YonderApp({
  initialTab = "home",
  initialCapture = false,
}: {
  initialTab?: Tab;
  initialCapture?: boolean;
}) {
  const activeTab = useSyncExternalStore(
    subscribeNavigation,
    tabSnapshot,
    () => initialTab,
  );
  const [activePhoto, setActivePhoto] = useState<SkyPhoto | null>(null);
  const [cameraOpen, setCameraOpen] = useState(initialCapture);
  const [savedPhotos, setSavedPhotos] = useState<SkyPhoto[]>([]);
  const [latestPhoto, setLatestPhoto] = useState<SkyPhoto | null>(null);
  const [profile, setProfile] = useState(defaultProfile);
  const [sheet, setSheet] = useState<
    "location" | "notifications" | "profile" | "note" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const objectUrls = useRef<string[]>([]);
  const sky = useSkyWeather();

  useEffect(() => {
    let cancelled = false;
    const urls = objectUrls.current;
    async function hydrate() {
      try {
        const memories = await readMemories();
        if (cancelled) return;
        setSavedPhotos(
          memories.map((memory) => {
            const image = URL.createObjectURL(memory.image);
            urls.push(image);
            return {
              ...memory,
              blob: memory.image,
              image,
              date: dateLabel(memory.createdAt),
              objects: objectsFor(memory.result),
            };
          }),
        );
      } catch {
        if (!cancelled)
          setError(
            "Memories storage is unavailable in this browser. You can still capture and analyze a sky.",
          );
      }
      try {
        const stored: Partial<LocalProfile> | null = JSON.parse(
          localStorage.getItem("yonder-profile") ?? "null",
        );
        if (stored && !cancelled)
          setProfile(
            Object.fromEntries(
              Object.entries(defaultProfile).map(([key, value]) => [
                key,
                typeof stored[key as keyof LocalProfile] === "string"
                  ? stored[key as keyof LocalProfile]!.slice(0, 180)
                  : value,
              ]),
            ) as LocalProfile,
          );
      } catch {
        /* A fresh local profile works when browser storage is disabled. */
      }
    }
    void hydrate();
    function onBack() {
      setCameraOpen(false);
      setActivePhoto(null);
      setSheet(null);
    }
    window.addEventListener("popstate", onBack);
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", onBack);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function navigate(tab: Tab) {
    window.history.pushState({}, "", tab === "home" ? "/" : `/?tab=${tab}`);
    window.dispatchEvent(new Event("yonder:navigate"));
  }
  function pushOverlay() {
    window.history.pushState({ yonderOverlay: true }, "", window.location.href);
  }
  function openPhoto(photo: SkyPhoto) {
    pushOverlay();
    setActivePhoto(photo);
  }
  function openCamera() {
    pushOverlay();
    setCameraOpen(true);
  }
  function closeOverlay() {
    setCameraOpen(false);
    setActivePhoto(null);
    if (window.history.state?.yonderOverlay) window.history.back();
  }
  function completed(file: File, result: SkyPhotoResult) {
    const image = URL.createObjectURL(file);
    objectUrls.current.push(image);
    const createdAt = new Date().toISOString();
    const photo: SkyPhoto = {
      id: result.photo_id ?? crypto.randomUUID(),
      image,
      blob: file,
      result,
      title: result.reveal?.analysis.headline ?? "My sky tonight",
      date: dateLabel(createdAt),
      createdAt,
      location: result.reveal ? `${result.reveal.meta.latitude.toFixed(3)}°, ${result.reveal.meta.longitude.toFixed(3)}°` : sky.chosen ? sky.place.name : "Location not recorded",
      objects: objectsFor(result),
      note: "",
    };
    setLatestPhoto(photo);
    setCameraOpen(false);
    setActivePhoto(photo);
  }
  function record(photo: SkyPhoto): StoredMemory | null {
    return photo.blob && photo.result && photo.createdAt
      ? {
          id: photo.id,
          image: photo.blob,
          title: photo.title,
          createdAt: photo.createdAt,
          location: photo.location,
          result: photo.result,
          note: photo.note ?? "",
        }
      : null;
  }
  async function toggleSave() {
    if (!activePhoto || saving) return;
    const photo = activePhoto;
    const exists = savedPhotos.some((item) => item.id === photo.id);
    setSaving(true);
    setError("");
    try {
      if (exists) {
        if (photo.result) await removeMemory(photo.id);
        setSavedPhotos((current) =>
          current.filter((item) => item.id !== photo.id),
        );
      } else {
        const memory = record(photo);
        if (memory) await writeMemory(memory);
        setSavedPhotos((current) => [
          photo,
          ...current.filter((item) => item.id !== photo.id),
        ]);
      }
    } catch {
      setError(
        "We could not update Memories. Your photo is still open. Free some browser storage and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveNote(note: string) {
    const latest = latestPhoto ?? savedPhotos.find((photo) => photo.result);
    if (!latest) return;
    const next = { ...latest, note };
    try {
      if (savedPhotos.some((photo) => photo.id === next.id)) {
        const memory = record(next);
        if (memory) await writeMemory(memory);
        setSavedPhotos((current) =>
          current.map((photo) => (photo.id === next.id ? next : photo)),
        );
      }
      setLatestPhoto(next);
      setSheet(null);
    } catch {
      setError("We could not save your note. Please try again.");
    }
  }

  const personalSky =
    latestPhoto ?? savedPhotos.find((photo) => photo.result) ?? null;
  return (
    <main className="app-stage">
      <div className="app-frame">
        <a className="skip-link" href="#yonder-content">
          Skip to content
        </a>
        <div
          className="app-content"
          inert={cameraOpen || Boolean(activePhoto) || Boolean(sheet)}
        >
          <div id="yonder-content" tabIndex={-1}>
            {activeTab === "home" && (
              <HomeScreen
                photo={personalSky}
                place={sky.place}
                weather={sky.weather}
                profile={profile}
                onLocation={() => setSheet("location")}
                onNotifications={() => setSheet("notifications")}
                onOpen={openPhoto}
                onCapture={openCamera}
                onNote={() => setSheet("note")}
              />
            )}
            {activeTab === "explore" && (
              <ExploreScreen
                place={sky.place}
                weather={sky.weather}
                weatherError={sky.weatherError}
                onRetry={sky.retry}
                onLocation={() => setSheet("location")}
                onOpen={openPhoto}
              />
            )}
            {activeTab === "memories" && (
              <MemoriesScreen
                savedPhotos={savedPhotos}
                onOpen={openPhoto}
                onCapture={openCamera}
              />
            )}
            {activeTab === "profile" && (
              <ProfileScreen
                profile={profile}
                savedPhotos={savedPhotos}
                onEdit={() => setSheet("profile")}
                onOpen={openPhoto}
                onCapture={openCamera}
                place={sky.chosen ? sky.place.name : "Choose your location"}
              />
            )}
          </div>
          <BottomNav
            active={activeTab}
            onChange={navigate}
            onCapture={openCamera}
          />
        </div>
        {cameraOpen && (
          <CameraFlow place={sky.chosen ? sky.place : undefined} onClose={closeOverlay} onComplete={completed} />
        )}
        {activePhoto && (
          <Discovery
            key={activePhoto.id}
            photo={activePhoto}
            saved={savedPhotos.some((photo) => photo.id === activePhoto.id)}
            saving={saving}
            error={error}
            onSave={() => void toggleSave()}
            onClose={closeOverlay}
          />
        )}
        {sheet === "location" && (
          <LocationSheet
            onChoose={(place) => {
              sky.choosePlace(place);
              setSheet(null);
            }}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === "notifications" && (
          <SimpleSheet title="Notifications" onClose={() => setSheet(null)}>
            <div className="notification-empty">
              <SkyIcon name="bell" size={28} />
              <h3>A quiet night.</h3>
              <p>No notifications yet.</p>
            </div>
          </SimpleSheet>
        )}
        {sheet === "profile" && (
          <ProfileEditor
            profile={profile}
            errorMessage={error}
            onClose={() => setSheet(null)}
            onSave={(next) => {
              try {
                localStorage.setItem("yonder-profile", JSON.stringify(next));
                setProfile(next);
                setSheet(null);
              } catch {
                setError(
                  "Your browser could not save your profile. Please try again.",
                );
              }
            }}
          />
        )}
        {sheet === "note" && (
          <NoteEditor
            note={personalSky?.note ?? ""}
            errorMessage={error}
            onClose={() => setSheet(null)}
            onSave={(note) => void saveNote(note)}
          />
        )}
        {error && !activePhoto && !sheet && (
          <div className="error-toast" role="alert">
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setError("")}
            >
              <SkyIcon name="close" size={18} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function HomeScreen({
  photo,
  place,
  weather,
  profile,
  onLocation,
  onNotifications,
  onOpen,
  onCapture,
  onNote,
}: {
  photo: SkyPhoto | null;
  place: Place;
  weather: CurrentWeather | null;
  profile: LocalProfile;
  onLocation: () => void;
  onNotifications: () => void;
  onOpen: (photo: SkyPhoto) => void;
  onCapture: () => void;
  onNote: () => void;
}) {
  const [feed, setFeed] = useState<"friends" | "nearby">("friends");
  const [liked, setLiked] = useState<string[]>([]);
  const posts = feed === "friends" ? friendPosts : [...friendPosts].reverse();
  return (
    <section
      className="screen scroll-screen social-home"
      aria-labelledby="home-title"
    >
      <header className="social-topbar">
        <button
          type="button"
          className="location-pill"
          onClick={onLocation}
          aria-label={`Change location, currently ${place.name}`}
        >
          <SkyIcon name="location" size={15} />
          <span>{place.name}</span>
        </button>
        <h1 id="home-title">Yonder</h1>
        <button
          type="button"
          className="notification-button"
          aria-label="Notifications"
          onClick={onNotifications}
        >
          <SkyIcon name="bell" size={22} />
        </button>
      </header>
      <div className="feed-tabs" role="tablist" aria-label="Sky feed">
        {(["friends", "nearby"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            id={`feed-${tab}`}
            className={feed === tab ? "is-active" : ""}
            role="tab"
            aria-selected={feed === tab}
            aria-controls="sky-feed"
            tabIndex={feed === tab ? 0 : -1}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "friends"
                    : event.key === "End"
                      ? "nearby"
                      : feed === "friends"
                        ? "nearby"
                        : "friends";
                setFeed(next);
                document.getElementById(`feed-${next}`)?.focus();
              }
            }}
            onClick={() => setFeed(tab)}
          >
            {tab === "friends" ? "Friends" : "Nearby"}
          </button>
        ))}
      </div>
      <article className="today-post">
        <div className="post-heading">
          <span className="post-avatar initials">
            {profile.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>My sky tonight</strong>
            <span>
              {photo ? photo.location : "Your next night starts here"}
            </span>
          </div>
          <span className="sky-condition">{conditionLabel(weather)}</span>
        </div>
        <button
          type="button"
          className="main-sky-photo"
          onClick={() => (photo ? onOpen(photo) : onCapture())}
        >
          <img
            src={photo?.image ?? IMG.home}
            alt={
              photo
                ? "Your sky photograph"
                : "Sample star-filled sky, capture your own"
            }
          />
          <span className="sky-object-tag">
            <SkyIcon name={photo ? "spark" : "camera"} size={15} />
            {photo ? identificationLabel(photo.result) : "Capture your sky"}
          </span>
        </button>
        <button
          type="button"
          className="add-caption"
          onClick={photo ? onNote : onCapture}
        >
          {photo
            ? photo.note || "Add a note about your sky…"
            : "A little of tonight, kept forever."}
        </button>
      </article>
      <div id="sky-feed" role="tabpanel" aria-labelledby={`feed-${feed}`}>
        <p className="feed-preview-label">A glimpse of Yonder · sample posts</p>
        <div
          className="social-feed"
          aria-label={
            feed === "friends"
              ? "Sample friends' sky posts"
              : "Sample nearby sky posts"
          }
        >
          {posts.map((post) => {
            const sample: SkyPhoto = {
              id: `friend-${post.name}`,
              image: post.image,
              title: `${post.name}'s sky`,
              date: "Sample photograph",
              location: post.place.split(" · ")[0],
              objects: [],
              credit: "Photography via Unsplash",
            };
            return (
              <article className="social-post" key={post.name}>
                <div className="post-heading">
                  <span className="post-avatar initials">{post.initials}</span>
                  <div>
                    <strong>{post.name}</strong>
                    <span>{sample.location} · sample</span>
                  </div>
                  <IconButton
                    label={`Open ${post.name}'s sample sky`}
                    icon="arrow"
                    onClick={() => onOpen(sample)}
                  />
                </div>
                <button
                  type="button"
                  className="feed-photo"
                  onClick={() => onOpen(sample)}
                >
                  <img
                    src={post.image}
                    alt={`${post.name}'s sample sky photograph`}
                    loading="lazy"
                  />
                  <span className="feed-photo-shade" />
                  <span className="feed-object">
                    <SkyIcon name="spark" size={15} />
                    {post.object}
                  </span>
                </button>
                <div className="post-footer">
                  <button
                    type="button"
                    aria-pressed={liked.includes(post.name)}
                    onClick={() =>
                      setLiked((current) =>
                        current.includes(post.name)
                          ? current.filter((name) => name !== post.name)
                          : [...current, post.name],
                      )
                    }
                  >
                    {liked.includes(post.name)
                      ? "Appreciated"
                      : "Appreciate this sky"}
                  </button>
                  <button type="button" onClick={() => onOpen(sample)}>
                    View sky
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ExploreScreen({
  place,
  weather,
  weatherError,
  onRetry,
  onLocation,
  onOpen,
}: {
  place: Place;
  weather: CurrentWeather | null;
  weatherError: boolean;
  onRetry: () => void;
  onLocation: () => void;
  onOpen: (photo: SkyPhoto) => void;
}) {
  const inspiration = [
    { title: "Open skies", image: IMG.ridge },
    { title: "Darker horizons", image: IMG.field },
    { title: "Deep-sky color", image: IMG.orion },
  ];
  function openImage(title: string, image: string) {
    onOpen({
      id: `inspiration-${title}`,
      title,
      image,
      date: "Astrophotography inspiration",
      location: "Sample photograph",
      objects: [],
      credit: "Photography via Unsplash",
    });
  }
  return (
    <section
      className="screen scroll-screen explore-screen"
      aria-labelledby="explore-title"
    >
      <header className="page-header">
        <div>
          <button
            type="button"
            className="eyebrow location-text"
            onClick={onLocation}
          >
            {place.name} · {coordinateLabel(place)}
          </button>
          <h1 id="explore-title">Made for your sky</h1>
        </div>
        <span className="sky-condition">{conditionLabel(weather)}</span>
      </header>
      <div className="weather-strip">
        {weather ? (
          <>
            <strong>{Math.round(weather.temperature)}°C</strong>
            <span>{weather.cloudCover}% cloud</span>
            <span>{weather.isDay ? "Daylight" : "After dark"}</span>
            <small>
              Open-Meteo ·{" "}
              {new Intl.DateTimeFormat("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: weather.timezone,
              }).format(new Date(weather.time * 1000))}
            </small>
          </>
        ) : weatherError ? (
          <button type="button" onClick={onRetry}>
            Weather unavailable · retry
          </button>
        ) : (
          <span role="status">Checking the sky…</span>
        )}
      </div>
      <button
        className="feature-story"
        type="button"
        onClick={() => openImage("A little farther out", IMG.orion)}
      >
        <img src={IMG.orion} alt="Nebula astrophotography" />
        <span className="feature-gradient" />
        <span className="feature-copy">
          <small>Beyond the city lights</small>
          <strong>A little farther out</strong>
          <span>A sky worth getting to know</span>
        </span>
        <span className="feature-arrow">
          <SkyIcon name="arrow" size={20} />
        </span>
      </button>
      <div className="section-heading">
        <h2>Find your next night</h2>
        <span>Inspiration</span>
      </div>
      <div className="object-rail">
        {inspiration.map((item) => (
          <button
            type="button"
            className="object-card"
            key={item.title}
            onClick={() => openImage(item.title, item.image)}
          >
            <img
              src={item.image}
              alt={`${item.title} astrophotography`}
              loading="lazy"
            />
            <span className="object-card-shade" />
            <span>
              <strong>{item.title}</strong>
              <small>Explore the photograph</small>
            </span>
          </button>
        ))}
      </div>
      <div className="explore-note">
        <SkyIcon name="spark" size={18} />
        <p>
          Give your eyes time to adjust. A darker spot can change everything.
        </p>
        <a
          href="https://science.nasa.gov/skywatching/"
          target="_blank"
          rel="noreferrer"
        >
          Skywatching guide <SkyIcon name="arrow" size={16} />
        </a>
      </div>
    </section>
  );
}

function ProfileScreen({
  profile,
  savedPhotos,
  onEdit,
  onOpen,
  onCapture,
  place,
}: {
  profile: LocalProfile;
  savedPhotos: SkyPhoto[];
  onEdit: () => void;
  onOpen: (photo: SkyPhoto) => void;
  onCapture: () => void;
  place: string;
}) {
  const real = savedPhotos.filter((photo) => photo.result);
  const days = new Set(
    real
      .filter((photo) => photo.createdAt)
      .map((photo) => new Date(photo.createdAt!).toLocaleDateString("en-CA")),
  );
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toLocaleDateString("en-CA")))
    cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toLocaleDateString("en-CA"))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return (
    <section
      className="screen scroll-screen profile-screen"
      aria-labelledby="profile-title"
    >
      <header className="profile-header">
        <p className="wordmark">Yonder</p>
        <button type="button" aria-label="Edit profile" onClick={onEdit}>
          <span />
          <span />
          <span />
        </button>
      </header>
      <div className="profile-identity">
        <div className="profile-photo profile-monogram">
          {profile.name.slice(0, 2).toUpperCase()}
          <span>
            <SkyIcon name="spark" size={15} />
          </span>
        </div>
        <div>
          <h1 id="profile-title">{profile.name}</h1>
          <p>@{profile.handle}</p>
        </div>
      </div>
      <p className="profile-bio">{profile.bio}</p>
      <div className="profile-facts" aria-label="Profile details">
        <span>
          <SkyIcon name="location" size={16} />
          {place}
        </span>
        {profile.school && <span>{profile.school}</span>}
        {profile.sign && <span>{profile.sign}</span>}
      </div>
      <div className="streak-card">
        <div>
          <p className="eyebrow">Looking-up streak</p>
          <strong>
            {streak} {streak === 1 ? "night" : "nights"}
          </strong>
          <span>
            {streak ? "Keep looking up" : "Your first night is waiting"}
          </span>
        </div>
        <div className="streak-orbit">
          <span>{streak}</span>
        </div>
      </div>
      <div className="profile-stats">
        <div>
          <strong>{real.length}</strong>
          <span>Skies</span>
        </div>
        <div>
          <strong>
            {real.reduce((count, photo) => count + photo.objects.length, 0)}
          </strong>
          <span>Discoveries</span>
        </div>
        <div>
          <strong>
            {
              new Set(
                real
                  .map((photo) => photo.location)
                  .filter((location) => location !== "Location not recorded"),
              ).size
            }
          </strong>
          <span>Places</span>
        </div>
      </div>
      <div className="section-heading profile-section-heading">
        <h2>Featured skies</h2>
        <span>From your Memories</span>
      </div>
      {real.length ? (
        <div className="featured-skies">
          {real.slice(0, 2).map((photo) => (
            <button type="button" key={photo.id} onClick={() => onOpen(photo)}>
              <img src={photo.image} alt={photo.title} />
              <span>
                <strong>{photo.title}</strong>
                <small>{photo.location}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="profile-first-sky" onClick={onCapture}>
          <SkyIcon name="camera" size={25} />
          <span>Your first sky belongs here.</span>
        </button>
      )}
      <p className="local-note">
        Your profile and Memories stay on this device.
      </p>
    </section>
  );
}

function SimpleSheet({
  title,
  children,
  onClose,
  errorMessage,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  errorMessage?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="utility-dialog"
      aria-labelledby="utility-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="sheet-heading">
        <h2 id="utility-title">{title}</h2>
        <IconButton
          label={`Close ${title.toLowerCase()}`}
          icon="close"
          onClick={onClose}
        />
      </div>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {children}
    </dialog>
  );
}
function ProfileEditor({
  profile,
  onSave,
  onClose,
  errorMessage,
}: {
  profile: LocalProfile;
  errorMessage?: string;
  onSave: (profile: LocalProfile) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || !/^[a-zA-Z0-9._-]{1,30}$/.test(draft.handle)) {
      setError(
        "Add your name and a handle using letters, numbers, dots or underscores.",
      );
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
  }
  return (
    <SimpleSheet
      title="Your profile"
      onClose={onClose}
      errorMessage={errorMessage}
    >
      <form onSubmit={submit}>
        {(
          [
            { key: "name", label: "Name", max: 50 },
            { key: "handle", label: "Handle", max: 30 },
            { key: "bio", label: "About you", max: 180 },
            { key: "school", label: "School (optional)", max: 70 },
            { key: "sign", label: "Star sign (optional)", max: 30 },
          ] as const
        ).map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              value={draft[field.key]}
              maxLength={field.max}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="utility-primary">
          Save profile
        </button>
      </form>
    </SimpleSheet>
  );
}
function NoteEditor({
  note,
  onSave,
  onClose,
  errorMessage,
}: {
  note: string;
  errorMessage?: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(note);
  return (
    <SimpleSheet
      title="A note about tonight"
      onClose={onClose}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft.trim());
        }}
      >
        <label htmlFor="sky-note">Your note</label>
        <textarea
          id="sky-note"
          maxLength={280}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="What made you look up?"
        />
        <button type="submit" className="utility-primary">
          Save note
        </button>
      </form>
    </SimpleSheet>
  );
}
