"use client";

import { SkyIcon } from "./SkyIcon";

export default function LoadingScreen({ onCancel }: { onCancel?: () => void }) {
  return (
    <div className="loading-screen">
      {onCancel && (
        <button
          className="loading-cancel icon-button"
          type="button"
          aria-label="Cancel analysis"
          onClick={onCancel}
        >
          <SkyIcon name="close" />
        </button>
      )}
      <div className="loading-center" role="status" aria-live="polite">
        <span className="loading-mark">
          <SkyIcon name="spark" size={20} />
        </span>
        <p>Reading your sky</p>
        <span className="loading-line" aria-hidden="true">
          <i />
        </span>
      </div>
    </div>
  );
}
