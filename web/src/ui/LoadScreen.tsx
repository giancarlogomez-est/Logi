import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Icon, Logo } from './icons';

export function LoadScreen({ checking }: { checking: boolean }) {
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const loadFile = useStore((s) => s.loadFile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = loading || checking;

  return (
    <div className="load-screen">
      <div
        className={`load-card card${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) loadFile(f);
        }}
      >
        <div className="brand big">
          <Logo />
          <span>Logi</span>
        </div>
        <h1>Control de obra vial</h1>
        <p>
          Carga el alineamiento de tu proyecto exportado desde Civil&nbsp;3D en formato LandXML (<em>Salida → Exportar a LandXML</em>). Incluye el
          perfil y las secciones transversales para ver el terreno, los taludes y la calzada.
        </p>
        <div className="drop">
          {busy ? (
            <>
              <span className="spinner" />
              <strong>{checking ? 'Buscando proyecto…' : 'Leyendo LandXML y construyendo la vía…'}</strong>
            </>
          ) : (
            <>
              <Icon name="upload" size={28} />
              <strong>Arrastra aquí tu archivo .xml</strong>
              <span>o</span>
              <button className="btn primary" onClick={() => fileRef.current?.click()}>
                Seleccionar archivo
              </button>
            </>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".xml,.landxml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
            e.target.value = '';
          }}
        />
        <small className="muted">El archivo se procesa en tu navegador; no se envía a ningún servidor.</small>
      </div>
    </div>
  );
}
