"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconButton, SkyIcon } from "./SkyIcon";
import styles from "./FeedActions.module.css";

type Comment = { id: string; author: string; text: string };
type Reactions = { liked: boolean; comments: Comment[] };
// Keep demo interactions when switching tabs; no comments are sent to a service.
const sessionReactions = new Map<string, Reactions>();

export default function FeedActions({
  postId,
  author,
  profileName,
}: {
  postId: string;
  author: string;
  profileName: string;
}) {
  const [reactions, setReactions] = useState<Reactions>(() =>
    sessionReactions.get(postId) ?? { liked: false, comments: [] },
  );
  const [commentsOpen, setCommentsOpen] = useState(false);

  function update(next: Reactions) {
    sessionReactions.set(postId, next);
    setReactions(next);
  }

  return (
    <>
      <div className={styles.actions}>
        <button
          type="button"
          aria-label={`${reactions.liked ? "Unlike" : "Like"} ${author}'s sky`}
          aria-pressed={reactions.liked}
          onClick={() => update({ ...reactions, liked: !reactions.liked })}
        >
          <SkyIcon name="heart" size={19} />
          {reactions.liked ? "Liked · 1" : "Like"}
        </button>
        <button type="button" onClick={() => setCommentsOpen(true)}>
          <SkyIcon name="comment" size={19} />
          Comments{reactions.comments.length ? ` · ${reactions.comments.length}` : ""}
        </button>
      </div>
      {commentsOpen && (
        <CommentsDialog
          author={author}
          comments={reactions.comments}
          onClose={() => setCommentsOpen(false)}
          onPost={(text) => update({
            ...reactions,
            comments: [...reactions.comments, { id: crypto.randomUUID(), author: profileName, text }],
          })}
        />
      )}
    </>
  );
}

function CommentsDialog({ author, comments, onClose, onPost }: {
  author: string;
  comments: Comment[];
  onClose: () => void;
  onPost: (text: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    onPost(draft.trim());
    setDraft("");
  }
  return (
    <dialog
      ref={dialog}
      className={`utility-dialog ${styles.dialog}`}
      aria-label={`Comments on ${author}'s sky`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="sheet-heading">
        <h2>Comments</h2>
        <IconButton label="Close comments" icon="close" onClick={onClose} />
      </div>
      <div className={styles.thread} aria-live="polite">
        {comments.length ? comments.map((comment) => (
          <article key={comment.id}>
            <strong>{comment.author}</strong>
            <p>{comment.text}</p>
          </article>
        )) : <p className={styles.empty}>Be the first to share a thought about this sky.</p>}
      </div>
      <form onSubmit={submit} className={styles.composer}>
        <label>Add a comment
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} rows={2} placeholder="What caught your eye?" />
        </label>
        <button type="submit" disabled={!draft.trim()}>Post</button>
      </form>
    </dialog>
  );
}
