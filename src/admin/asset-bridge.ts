// Makes a picture that was just uploaded show up in the editor (the thumbnail in an image field, and the live preview).
//
// Decap keeps an uploaded file under its folder in the repository (`public/media/vlogs/x.png`, as a blob: URL until the post is
// saved) but the post says where the *site* serves it (`/media/vlogs/x.png`). Decap treats any path that starts with "/" as a
// ready-made web address, so it never connects the two: the thumbnail and the preview showed a broken image until the post was
// published. The fix is to ask Decap for the file by its name, which it resolves through the field's folder to the upload, and to
// fall back to the path as it was when that finds nothing (an image that is already live is served by the site itself).
//
// Only paths shaped like our upload folders are rewritten (one level under /media/<kind>/ or /src/assets/<group>/): an older
// image in a deeper folder, like /media/vlogs/building-vesper-drift/poster.jpg, cannot be mistaken for a new upload with the same name.
import { createElement as h, type ComponentType } from 'react';

type GetAsset = (path: string, field?: unknown) => { toString(): string } | undefined;

const UPLOAD_PATH = /^\/(?:media|src\/assets)\/[a-z0-9-]+\/[^/]+$/;
/** What Decap hands back for a file it holds: a blob: URL (or data:, or a web address). Anything else means "not found". */
const usable = (url: string) => /^(blob:|data:|https?:)/.test(url);

const bridged = new WeakMap<GetAsset, GetAsset>();

/** `getAsset` that also finds an upload by its file name. The same function in gives the same function out (React compares them). */
export function bridgeGetAsset(getAsset: GetAsset): GetAsset {
  let wrapped = bridged.get(getAsset);
  if (!wrapped) {
    wrapped = (path, field) => {
      if (typeof path === 'string' && UPLOAD_PATH.test(path)) {
        const found = getAsset(path.slice(path.lastIndexOf('/') + 1), field);
        if (usable(String(found ?? ''))) return found;
      }
      return getAsset(path, field);
    };
    bridged.set(getAsset, wrapped);
  }
  return wrapped;
}

/** Wraps Decap's image widget so the thumbnail in the form uses `bridgeGetAsset`. Props, including the `ref`, pass straight through. */
export function withAssetBridge<P extends { getAsset?: GetAsset }>(Control: ComponentType<P>): ComponentType<P> {
  const Bridged = (props: P) => h(Control, { ...props, getAsset: props.getAsset ? bridgeGetAsset(props.getAsset) : undefined });
  Bridged.displayName = `AssetBridge(${Control.displayName ?? Control.name ?? 'ImageControl'})`;
  return Bridged as ComponentType<P>;
}
