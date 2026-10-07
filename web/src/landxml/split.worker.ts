import { splitLandXml } from './parse';

const scope = self as unknown as {
  onmessage: (ev: MessageEvent<Blob>) => void;
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
};

/** Lee el archivo y hace la parte pesada fuera del hilo de la interfaz */
scope.onmessage = async (ev) => {
  try {
    const result = splitLandXml(await ev.data.text());
    const transfer: Transferable[] = result.terrain ? [result.terrain.points.buffer, result.terrain.faces.buffer] : [];
    scope.postMessage({ ok: true, result }, transfer);
  } catch (e) {
    scope.postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
