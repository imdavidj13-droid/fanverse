import { useRef } from "react";
import { X, ZoomIn } from "lucide-react";
export function MediaViewer({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="media-open"
        aria-label="Open photo"
        onClick={() => dialog.current?.showModal()}
      >
        <img src={src} alt={alt} loading="lazy" />
        <span>
          <ZoomIn size={16} /> View photo
        </span>
      </button>
      <dialog
        className="media-dialog"
        ref={dialog}
        aria-label="Photo viewer"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <button
          autoFocus
          className="media-close"
          aria-label="Close photo viewer"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        <img src={src} alt={alt} />
        <p>{caption || alt}</p>
      </dialog>
    </>
  );
}
