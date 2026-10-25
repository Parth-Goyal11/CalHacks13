import { type Tab, type IconName } from "./sky-data";
import { SkyIcon } from "./SkyIcon";

export default function BottomNav({
  active,
  onChange,
  onCapture,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  onCapture: () => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <NavItem
        id="home"
        label="Home"
        icon="home"
        active={active}
        onChange={onChange}
      />
      <NavItem
        id="explore"
        label="Explore"
        icon="explore"
        active={active}
        onChange={onChange}
      />
      <button
        className="nav-capture"
        type="button"
        aria-label="Capture the sky"
        onClick={() => onCapture()}
      >
        <SkyIcon name="camera" size={27} />
      </button>
      <NavItem
        id="memories"
        label="Memories"
        icon="calendar"
        active={active}
        onChange={onChange}
      />
      <button
        type="button"
        className={`nav-item profile-nav ${
          active === "profile" ? "is-active" : ""
        }`}
        aria-current={active === "profile" ? "page" : undefined}
        onClick={() => onChange("profile")}
      >
        <span className="profile-nav-avatar" aria-hidden="true">
          <SkyIcon name="spark" size={17} />
        </span>
        <span>Profile</span>
      </button>
    </nav>
  );
}

function NavItem({
  id,
  label,
  icon,
  active,
  onChange,
}: {
  id: Tab;
  label: string;
  icon: IconName;
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <button
      type="button"
      className={`nav-item ${active === id ? "is-active" : ""}`}
      aria-current={active === id ? "page" : undefined}
      onClick={() => onChange(id)}
    >
      <span className="nav-icon">
        <SkyIcon name={icon} size={21} />
      </span>
      <span>{label}</span>
    </button>
  );
}
