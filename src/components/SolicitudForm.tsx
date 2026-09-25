import { useId, useState } from "react";
import type { AnexoIData, AutorizacionData, Persona, Solicitante } from "../lib/anexos-pdf";

// Rellena el Anexo I o II de la ordenanza, o la autorización de la persona propietaria del terreno,
// y descarga el PDF listo para firmar.
// Todo ocurre en el navegador: los datos no se envían ni se guardan en el servidor.

type Props = {
  anexo: "i" | "ii" | "aut";
  municipio: string;
  escudoSrc: string;
  nombre?: string;
  email?: string;
};

const FILE = {
  i: "anexo-i-solicitud-registro-colonia.pdf",
  iAut: "anexo-i-y-autorizacion-propietario.pdf",
  ii: "anexo-ii-solicitud-alta-colaborador.pdf",
  aut: "autorizacion-propietario-terreno.pdf",
};
const vacia = (): Persona => ({ nombre: "", nif: "", telefono: "", email: "" });
const hoy = () => new Date().toISOString().slice(0, 10);

/** Convierte el escudo (PNG, JPG o WebP) a PNG con un canvas, para poder incrustarlo en el PDF. */
async function escudoPng(src: string): Promise<Uint8Array | undefined> {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const h = 240;
    const w = Math.round((img.naturalWidth / img.naturalHeight) * h);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
  } catch {
    return undefined; // sin escudo, el PDF sigue siendo válido
  }
}

function Text({
  label,
  value,
  onChange,
  type = "text",
  hint,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = useId();
  return (
    <div className="solicitud-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p className="muted text-sm mt-0" id={`${id}-h`}>
          {hint}
        </p>
      )}
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} {...rest} />
    </div>
  );
}

export default function SolicitudForm({ anexo, municipio, escudoSrc, nombre = "", email = "" }: Props) {
  const [sol, setSol] = useState<Required<Solicitante>>({ nombre, nif: "", direccion: "", telefono: "", email });
  const [yoCuido, setYoCuido] = useState(true);
  const [otros, setOtros] = useState<Persona[]>([]);
  const [col, setCol] = useState<Required<AnexoIData["colonia"]>>({
    direccion: "",
    coordenadas: "",
    titularidad: "",
    hembrasEsterilizadas: "",
    hembrasSinEsterilizar: "",
    machosCastrados: "",
    machosSinCastrar: "",
    adoptables: "",
    enfermos: "",
  });
  const [prop, setProp] = useState<Required<AutorizacionData["propietario"]>>({ nombre: "", nif: "", direccion: "", telefono: "", email: "", representa: "" });
  const [catastral, setCatastral] = useState("");
  const [conAut, setConAut] = useState(true);
  const [lugar, setLugar] = useState(municipio);
  const [fecha, setFecha] = useState(hoy());
  const [geo, setGeo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const setS = (k: keyof Solicitante) => (v: string) => setSol((s) => ({ ...s, [k]: v }));
  const setC = (k: keyof AnexoIData["colonia"]) => (v: string) => setCol((c) => ({ ...c, [k]: v }));
  const setP = (k: keyof AutorizacionData["propietario"]) => (v: string) => setProp((x) => ({ ...x, [k]: v }));
  const privado = anexo === "i" && col.titularidad === "privado";
  const maxOtros = yoCuido ? 3 : 4;

  function ubicacion() {
    if (!("geolocation" in navigator)) {
      setGeo("Este dispositivo no permite obtener la ubicación. Cópiala de la aplicación de mapas.");
      return;
    }
    setGeo("Obteniendo la ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setC("coordenadas")(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`);
        setGeo(`Ubicación añadida (precisión aproximada: ${Math.round(p.coords.accuracy)} m). Hazlo junto a la colonia.`);
      },
      () => setGeo("No se ha podido obtener la ubicación. Revisa el permiso de ubicación o cópiala de la aplicación de mapas."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function generar(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const [{ anexoI, anexoII, autorizacionPropietario, unirPdfs }, escudo] = await Promise.all([import("../lib/anexos-pdf"), escudoPng(escudoSrc)]);
      const f = fecha ? new Date(`${fecha}T12:00:00`) : null;
      // En el Anexo I con solar privado, la autorización sale con los datos del terreno y de la persona
      // responsable; la persona propietaria completa los suyos a mano, o se rellenan en su pestaña.
      const aut = (propietario: AutorizacionData["propietario"]) =>
        autorizacionPropietario({
          municipio,
          escudoPng: escudo,
          data: {
            propietario,
            terreno: { direccion: col.direccion, coordenadas: col.coordenadas, referenciaCatastral: catastral },
            responsable: { nombre: sol.nombre, nif: sol.nif },
            lugar: anexo === "aut" ? lugar : "",
            fecha: anexo === "aut" ? f : null,
          },
        });
      const incluirAut = privado && conAut;
      let bytes =
        anexo === "aut"
          ? await aut(prop)
          : anexo === "i"
          ? await anexoI({
              municipio,
              escudoPng: escudo,
              data: {
                solicitante: sol,
                cuidadores: [...(yoCuido ? [{ nombre: sol.nombre, nif: sol.nif, telefono: sol.telefono, email: sol.email }] : []), ...otros].slice(0, 4),
                colonia: col,
                lugar,
                fecha: f,
              },
            })
          : await anexoII({ municipio, escudoPng: escudo, data: { solicitante: sol, lugar, fecha: f } });
      if (incluirAut) bytes = await unirPdfs([bytes, await aut({})], "Anexo I y autorización de la persona propietaria del terreno");
      if (url) URL.revokeObjectURL(url);
      const u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      setUrl(u);
      const a = document.createElement("a");
      a.href = u;
      a.download = incluirAut ? FILE.iAut : FILE[anexo];
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus({
        ok: true,
        msg:
          anexo === "aut"
            ? "PDF generado. La persona propietaria debe firmarlo; preséntalo con el Anexo I y una fotocopia de su DNI."
            : incluirAut
            ? "PDF generado con dos páginas: el Anexo I, que firmas tú, y la autorización, que completa y firma la persona propietaria."
            : "PDF generado. Imprímelo, fírmalo y preséntalo en el Ayuntamiento.",
      });
    } catch {
      setStatus({ ok: false, msg: "No se ha podido generar el PDF. Inténtalo de nuevo o descarga el formulario en blanco." });
    } finally {
      setBusy(false);
    }
  }

  const coordenadas = (
    <>
      <Text
        label="Coordenadas"
        value={col.coordenadas}
        onChange={setC("coordenadas")}
        autoComplete="off"
        maxLength={60}
        hint="Latitud y longitud, por ejemplo 40.0712, -4.4040."
      />
      <button type="button" className="btn small" onClick={ubicacion}>
        Usar mi ubicación actual
      </button>
      {geo && (
        <p className="muted text-sm" role="status">
          {geo}
        </p>
      )}
    </>
  );

  const persona = (p: Persona, i: number) => {
    const upd = (k: keyof Persona) => (v: string) => setOtros((o) => o.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    return (
      <fieldset className="solicitud-persona" key={i}>
        <legend>Persona cuidadora {i + 1 + (yoCuido ? 1 : 0)}</legend>
        <Text label="Nombre y apellidos" value={p.nombre ?? ""} onChange={upd("nombre")} autoComplete="off" maxLength={120} />
        <div className="solicitud-grid">
          <Text label="NIF" value={p.nif ?? ""} onChange={upd("nif")} autoComplete="off" maxLength={20} />
          <Text label="Teléfono" type="tel" value={p.telefono ?? ""} onChange={upd("telefono")} autoComplete="off" maxLength={30} />
        </div>
        <Text label="Correo electrónico" type="email" value={p.email ?? ""} onChange={upd("email")} autoComplete="off" maxLength={120} />
        <button type="button" className="btn small ghost" onClick={() => setOtros((o) => o.filter((_, j) => j !== i))}>
          Quitar a esta persona
        </button>
      </fieldset>
    );
  };

  return (
    <form className="solicitud" onSubmit={generar} noValidate>
      <p className="alert info">
        <span>
          Tus datos <strong>no se envían ni se guardan</strong>: el PDF se crea en este dispositivo. Los campos que dejes vacíos
          aparecerán en blanco para rellenarlos a mano.
        </span>
      </p>

      {anexo === "aut" && (
        <>
          <fieldset className="card">
            <legend>
              <h2 className="mt-0">Persona propietaria del terreno</h2>
            </legend>
            <p className="muted text-sm mt-0">Pide permiso a la persona propietaria antes de escribir aquí sus datos.</p>
            <Text label="Nombre y apellidos" value={prop.nombre} onChange={setP("nombre")} autoComplete="off" maxLength={120} />
            <Text label="NIF" value={prop.nif} onChange={setP("nif")} autoComplete="off" maxLength={20} />
            <Text label="Dirección" value={prop.direccion} onChange={setP("direccion")} autoComplete="off" maxLength={160} />
            <div className="solicitud-grid">
              <Text label="Teléfono" type="tel" value={prop.telefono} onChange={setP("telefono")} autoComplete="off" maxLength={30} />
              <Text label="Correo electrónico" type="email" value={prop.email} onChange={setP("email")} autoComplete="off" maxLength={120} />
            </div>
            <Text
              label="En representación de (opcional)"
              value={prop.representa}
              onChange={setP("representa")}
              autoComplete="off"
              maxLength={120}
              hint="Si firma en nombre de una empresa, una comunidad de propietarios u otra persona."
            />
          </fieldset>
          <fieldset className="card">
            <legend>
              <h2 className="mt-0">Terreno</h2>
            </legend>
            <Text label="Dirección o ubicación" value={col.direccion} onChange={setC("direccion")} autoComplete="off" maxLength={160} />
            <Text
              label="Referencia catastral (opcional)"
              value={catastral}
              onChange={setCatastral}
              autoComplete="off"
              maxLength={30}
              hint="Está en el recibo del IBI o en la Sede Electrónica del Catastro."
            />
            {coordenadas}
          </fieldset>
        </>
      )}

      <fieldset className="card">
        <legend>
          <h2 className="mt-0">{anexo === "aut" ? "Persona cuidadora responsable de la colonia" : "Tus datos"}</h2>
        </legend>
        <Text label="Nombre y apellidos" value={sol.nombre} onChange={setS("nombre")} autoComplete="name" maxLength={120} />
        <Text label="NIF" value={sol.nif} onChange={setS("nif")} autoComplete="off" maxLength={20} />
        {anexo !== "aut" && (
          <>
        <Text label="Dirección" value={sol.direccion} onChange={setS("direccion")} autoComplete="street-address" maxLength={160} />
        <div className="solicitud-grid">
          <Text label="Teléfono" type="tel" value={sol.telefono} onChange={setS("telefono")} autoComplete="tel" maxLength={30} />
          <Text label="Correo electrónico" type="email" value={sol.email} onChange={setS("email")} autoComplete="email" maxLength={120} />
        </div>
          </>
        )}
      </fieldset>

      {anexo === "i" && (
        <>
          <fieldset className="card">
            <legend>
              <h2 className="mt-0">Personas cuidadoras de la colonia</h2>
            </legend>
            <p className="muted text-sm mt-0">Hasta cuatro personas. Todas deben estar acreditadas.</p>
            <label className="check">
              <input type="checkbox" checked={yoCuido} onChange={(e) => { setYoCuido(e.target.checked); if (e.target.checked) setOtros((o) => o.slice(0, 3)); }} />
              Yo también seré cuidador/a de la colonia
            </label>
            {otros.map(persona)}
            {otros.length < maxOtros && (
              <button type="button" className="btn small" onClick={() => setOtros((o) => [...o, vacia()])}>
                Añadir otra persona cuidadora
              </button>
            )}
          </fieldset>

          <fieldset className="card">
            <legend>
              <h2 className="mt-0">Datos de la colonia</h2>
            </legend>
            <Text label="Dirección exacta" value={col.direccion} onChange={setC("direccion")} autoComplete="off" maxLength={160} />
            {coordenadas}
            <div className="solicitud-radio" role="radiogroup" aria-labelledby="tit-l">
              <p className="label" id="tit-l">
                ¿El solar es público o privado?
              </p>
              {(["publico", "privado"] as const).map((t) => (
                <label className="check" key={t}>
                  <input type="radio" name="titularidad" checked={col.titularidad === t} onChange={() => setC("titularidad")(t)} />
                  {t === "publico" ? "Público" : "Privado (con autorización de la persona propietaria)"}
                </label>
              ))}
            </div>
            {privado && (
              <div className="alert info solicitud-aut">
                <p className="mt-0">
                  En un terreno privado hace falta la <strong>autorización expresa de la persona propietaria</strong> (apartado 7.1.4 de la
                  ordenanza).
                </p>
                <label className="check">
                  <input type="checkbox" checked={conAut} onChange={(e) => setConAut(e.target.checked)} />
                  Añadir al PDF la autorización, con los datos del terreno y los tuyos ya puestos
                </label>
                {conAut && (
                  <Text
                    label="Referencia catastral (opcional)"
                    value={catastral}
                    onChange={setCatastral}
                    autoComplete="off"
                    maxLength={30}
                    hint="Está en el recibo del IBI o en la Sede Electrónica del Catastro."
                  />
                )}
                <p className="text-sm mb-0">
                  La persona propietaria completa sus datos y firma. Si prefieres rellenarlos también aquí, usa la pestaña{" "}
                  <a href="/colonia/solicitud?anexo=aut">Autorización de la persona propietaria</a>. Descarga antes este PDF: al cambiar de pestaña se borra lo que hayas escrito.
                </p>
              </div>
            )}
            <fieldset className="solicitud-gatos">
              <legend className="label">Número de gatos</legend>
              <div className="solicitud-grid">
                <Text label="Hembras esterilizadas" value={col.hembrasEsterilizadas} onChange={setC("hembrasEsterilizadas")} inputMode="numeric" maxLength={4} />
                <Text label="Hembras sin esterilizar" value={col.hembrasSinEsterilizar} onChange={setC("hembrasSinEsterilizar")} inputMode="numeric" maxLength={4} />
                <Text label="Machos castrados" value={col.machosCastrados} onChange={setC("machosCastrados")} inputMode="numeric" maxLength={4} />
                <Text label="Machos sin castrar" value={col.machosSinCastrar} onChange={setC("machosSinCastrar")} inputMode="numeric" maxLength={4} />
              </div>
            </fieldset>
            <Text
              label="Gatos domésticos abandonados o recién nacidos que podrían adoptarse"
              value={col.adoptables}
              onChange={setC("adoptables")}
              maxLength={80}
              hint="Número o breve descripción."
            />
            <SolicitudArea label="Gatos enfermos" hint="Si los hay, describe sus síntomas. Si no, déjalo vacío o escribe «No»." value={col.enfermos} onChange={setC("enfermos")} />
          </fieldset>
        </>
      )}

      <fieldset className="card">
        <legend>
          <h2 className="mt-0">Lugar y fecha</h2>
        </legend>
        <div className="solicitud-grid">
          <Text label="Lugar" value={lugar} onChange={setLugar} maxLength={60} />
          <Text label="Fecha" type="date" value={fecha} onChange={setFecha} hint="Déjala vacía para ponerla a mano al firmar." />
        </div>
      </fieldset>

      <button type="submit" className="btn primary block" aria-busy={busy} disabled={busy}>
        {busy ? "Generando el PDF…" : "Descargar el PDF relleno"}
      </button>
      <p role="status" aria-live="polite" className={status ? `alert ${status.ok ? "ok" : "bad"}` : "sr-only"}>
        {status?.msg}
        {status?.ok && url && (
          <>
            {" "}
            <a href={url} target="_blank" rel="noopener">
              Abrir el PDF
            </a>
          </>
        )}
      </p>
    </form>
  );
}

function SolicitudArea({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="solicitud-field">
      <label htmlFor={id}>{label}</label>
      <p className="muted text-sm mt-0" id={`${id}-h`}>
        {hint}
      </p>
      <textarea id={id} rows={3} maxLength={220} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-h`} />
    </div>
  );
}
