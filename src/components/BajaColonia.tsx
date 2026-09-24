import { useEffect, useRef, useState } from "react";

type Check = { id: string; ok: boolean; label: string; hint?: string };
type Result = { ok: boolean; checks: Check[]; jevDisponible: boolean; requiereRelevo: boolean; error?: string };

type Props = { colonyId: string; colonyName: string; requiereRelevo: boolean; minChars: number; sucesor?: string | null };

export default function BajaColonia({ colonyId, colonyName, requiereRelevo, minChars, sucesor }: Props) {
  const [texto, setTexto] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const seq = useRef(0);
  const checkedText = useRef("");

  // Comprobación automática 1 s después de dejar de escribir.
  useEffect(() => {
    setConfirming(false);
    const t = texto.trim();
    if (t.length < minChars) {
      setResult(null);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setChecking(true);
      setError(null);
      try {
        const res = await fetch(`/api/colonias/${colonyId}/baja/check`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ texto: t }),
        });
        const data = (await res.json()) as Result;
        if (id !== seq.current) return; // hay una comprobación más reciente
        if (!res.ok) throw new Error(data.error ?? "No se ha podido comprobar la explicación.");
        checkedText.current = t;
        setResult(data);
      } catch (e: any) {
        if (id === seq.current) setError(e.message);
      } finally {
        if (id === seq.current) setChecking(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [texto, colonyId, minChars]);

  const len = texto.trim().length;
  const upToDate = result && checkedText.current === texto.trim();
  const canSubmit = Boolean(upToDate && result?.ok && !checking && !sending);

  // Lista de requisitos: los que devuelve el servidor, o los básicos mientras no hay comprobación.
  const checks: Check[] = result?.checks ?? [
    { id: "longitud", ok: len >= minChars, label: "Explicación escrita", hint: len >= minChars ? undefined : `Escribe al menos ${minChars} caracteres (llevas ${len}).` },
    { id: "motivo", ok: false, label: "Motivo concreto" },
    ...(requiereRelevo ? [{ id: "relevo", ok: false, label: "Persona que se queda a cargo" }] : []),
  ];
  const pending = checks.filter((c) => !c.ok);

  let status: string;
  if (checking) status = "Comprobando la explicación…";
  else if (error) status = error;
  else if (canSubmit) status = "La explicación cumple los requisitos. Ya puedes comunicar la baja.";
  else if (len < minChars) status = `El botón se habilitará cuando la explicación cumpla los requisitos. Faltan ${minChars - len} caracteres.`;
  else if (!upToDate) status = "Se comprobará en cuanto dejes de escribir.";
  else status = "El botón no se habilita todavía: revisa lo que falta en la lista.";

  async function submit() {
    if (!canSubmit) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/colonias/${colonyId}/baja`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: texto.trim() }),
      });
      const data = (await res.json()) as { error?: string; checks?: Check[] };
      if (!res.ok) {
        if (data.checks) setResult({ ...(result as Result), ok: false, checks: data.checks });
        throw new Error(data.error ?? "No se ha podido tramitar la baja.");
      }
      location.href = "/colonia?baja=1";
    } catch (e: any) {
      setError(e.message);
      setSending(false);
      setConfirming(false);
    }
  }

  return (
    <div className="baja">
      <label htmlFor="baja-texto">¿Por qué dejas de colaborar en esta colonia?</label>
      <p className="muted text-sm mt-0" id="baja-help">
        Cuenta el motivo con tus palabras.
        {requiereRelevo
          ? " Como eres la única persona que cuida esta colonia, indica también quién se hará cargo de los gatos a partir de ahora o, si ya no queda ningún gato, explícalo."
          : " No hace falta que dejes a alguien a cargo."}
      </p>
      {sucesor && (
        <p className="alert info" id="baja-sucesor">
          <span>
            Eres la persona responsable de esta colonia. Si te das de baja, <strong>{sucesor}</strong> pasará a ser la persona responsable
            automáticamente.
          </span>
        </p>
      )}
      <textarea
        id="baja-texto"
        required
        maxLength={4000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-describedby="baja-help baja-checks baja-status"
        placeholder={requiereRelevo ? "Ej.: Me mudo a otra ciudad en octubre por trabajo. Mi vecina Carmen se hará cargo de la colonia." : "Ej.: Me mudo a otra ciudad en octubre por trabajo y no podré seguir viniendo."}
      />

      <ul className="baja-checks" id="baja-checks" aria-label="Requisitos para comunicar la baja">
        {checks.map((c) => (
          <li key={c.id} className={c.ok ? "ok" : "pending"}>
            <span aria-hidden="true" className="baja-icon">{c.ok ? "✓" : "•"}</span>
            <span>
              <span className="sr-only">{c.ok ? "Cumplido: " : "Pendiente: "}</span>
              <strong>{c.label}</strong>
              {!c.ok && c.hint && <span className="baja-hint">{c.hint}</span>}
            </span>
          </li>
        ))}
      </ul>

      <p id="baja-status" className={`baja-status ${error ? "is-bad" : canSubmit ? "is-ok" : ""}`} role="status" aria-live="polite">
        {status}
      </p>
      {result && !result.jevDisponible && (
        <p className="muted text-sm">La comprobación automática no está disponible ahora mismo: el Ayuntamiento revisará tu explicación.</p>
      )}

      {confirming && canSubmit && (
        <div className="alert bad" role="alert">
          <span>
            Vas a dejar de colaborar en <strong>{colonyName}</strong>. La colonia desaparecerá de tu carnet y el Ayuntamiento recibirá tu
            explicación.{sucesor ? ` ${sucesor} pasará a ser la persona responsable.` : ""} Pulsa «Confirmar la baja» para terminar.
          </span>
        </div>
      )}
      <div className="row">
        <button
          type="button"
          className={`btn ${confirming ? "danger" : ""}`}
          onClick={submit}
          disabled={!canSubmit}
          aria-busy={sending || checking}
          aria-describedby="baja-status"
        >
          {sending ? "Enviando…" : confirming ? "Confirmar la baja" : "Dejar de colaborar en esta colonia"}
        </button>
        {confirming && (
          <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
        )}
      </div>
      {!canSubmit && pending.length > 0 && len >= minChars && upToDate && (
        <p className="sr-only">Pendiente: {pending.map((p) => p.label).join(", ")}.</p>
      )}
    </div>
  );
}
