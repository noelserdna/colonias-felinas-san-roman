import { useEffect, useMemo, useRef, useState } from "react";

type QType = "mc" | "multi" | "written";
type Answer = number | number[] | string;
type Item = { position: number; type: QType; enunciado: string; options?: string[] };
type ReviewItem = {
  position: number;
  type: QType;
  enunciado: string;
  isCorrect: boolean | null;
  options?: string[];
  chosen?: number | number[] | string | null;
  correctIndex?: number;
  correctIndexes?: number[];
  explicacion?: string | null;
  referenceAnswer?: string | null;
};
type View = {
  id: string;
  kind: "unit" | "final";
  status: "in_progress" | "grading" | "passed" | "failed";
  passPct: number;
  scorePct: number | null;
  correctCount: number | null;
  totalCount: number;
  items?: Item[];
  review?: ReviewItem[];
  carnetNumero?: string | null;
};

type Props = {
  kind: "unit" | "final";
  unitId?: number;
  attemptId?: string;
  backHref: string;
  nextHref: string;
  nextLabel: string;
  /** Instancia demo: botón para rellenar con respuestas de ejemplo. */
  demo?: boolean;
};

const MAX_WRITTEN = 2000;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? "Error de conexión");
  return data as T;
}

function draftKey(id: string) {
  return `quiz-draft:${id}`;
}
function loadDraft(id: string): Record<string, Answer> {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) ?? "{}");
  } catch {
    return {};
  }
}
function saveDraft(id: string, a: Record<string, Answer>) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(a));
  } catch {}
}
function clearDraft(id: string) {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {}
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function Quiz(props: Props) {
  const [view, setView] = useState<View | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Texto de la región viva fija (siempre montada) para anuncios de estado.
  const [announce, setAnnounce] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  // Se activa tras una acción del usuario (empezar, enviar) para mover el foco al nuevo estado.
  const focusNext = useRef(false);
  const prevStatus = useRef<View["status"] | null>(null);

  useEffect(() => {
    if (props.attemptId) load(props.attemptId);
  }, [props.attemptId]);

  // Mientras JEV corrige, se consulta el estado cada pocos segundos.
  useEffect(() => {
    if (view?.status !== "grading") return;
    const t = setTimeout(() => load(view.id), 4000);
    return () => clearTimeout(t);
  }, [view]);

  // Gestión del foco y de los anuncios al cambiar de estado.
  useEffect(() => {
    const status = view?.status ?? null;
    const fromGrading = prevStatus.current === "grading" && status !== "grading";
    prevStatus.current = status;
    if (status === "grading") setAnnounce("Corrigiendo tus respuestas…");
    else if (fromGrading) setAnnounce("");
    if (!view || (!focusNext.current && !fromGrading)) return;
    focusNext.current = false;
    headRef.current?.focus({ preventScroll: true });
    topRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, [view?.status, view?.id]);

  function fail(message: string) {
    setError(message);
    setAnnounce(message);
  }

  async function load(id: string) {
    try {
      const v = await api<View>(`/api/attempts/${id}`);
      setView(v);
      if (v.status === "in_progress") setAnswers(loadDraft(id));
    } catch (e: any) {
      fail(e.message);
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    setAnnounce("");
    try {
      const { attemptId } = await api<{ attemptId: string }>("/api/attempts/start", {
        method: "POST",
        body: JSON.stringify(props.kind === "unit" ? { kind: "unit", unitId: props.unitId } : { kind: "final" }),
      });
      focusNext.current = true;
      await load(attemptId);
    } catch (e: any) {
      fail(e.message);
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(pos: number, value: Answer) {
    setAnswers((prev) => {
      const next = { ...prev, [String(pos)]: value };
      if (view) saveDraft(view.id, next);
      return next;
    });
    setConfirming(false);
  }

  const unanswered = useMemo(
    () =>
      (view?.items ?? []).filter((i) => {
        const a = answers[String(i.position)];
        return a == null || (typeof a === "string" && !a.trim()) || (Array.isArray(a) && a.length === 0);
      }).length,
    [view, answers],
  );

  async function submit() {
    if (!view) return;
    if (unanswered > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError(null);
    setAnnounce("");
    try {
      const v = await api<View>(`/api/attempts/${view.id}/submit`, { method: "POST", body: JSON.stringify({ answers }) });
      clearDraft(view.id);
      focusNext.current = true;
      setView(v);
    } catch (e: any) {
      fail(e.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  async function fillExample() {
    if (!view) return;
    try {
      const { answers: ex } = await api<{ answers: Record<string, Answer> }>(`/api/demo/respuestas/${view.id}`);
      setAnswers(ex);
      saveDraft(view.id, ex);
      setConfirming(false);
      setAnnounce("Respuestas de ejemplo rellenadas. Revísalas o envía el examen.");
    } catch (e: any) {
      fail(e.message);
    }
  }

  function retry() {
    setView(null);
    setAnswers({});
    start();
  }

  // Región viva fija: existe siempre y solo cambia su texto.
  const live = (
    <div className="sr-only" role="status">
      {announce}
    </div>
  );

  // El error se anuncia por la región viva; la caja es solo visual.
  const errorBox = error && <div className="alert bad">{error}</div>;

  return (
    <>
      {live}
      {renderState()}
    </>
  );

  function renderState() {
    // --- Antes de empezar ---
    if (!view) {
      return (
        <div ref={topRef} className="quiz">
          {errorBox}
          {!props.attemptId && (
            <div className="card">
              <p className="mt-0">
                {props.kind === "unit"
                  ? "El test tiene preguntas tipo test sobre este tema. Puedes repetirlo las veces que quieras; las preguntas cambian en cada intento."
                  : "Cuando pulses el botón se generará tu examen. Si sales, podrás continuarlo más tarde."}
              </p>
              <button className="btn primary block" onClick={start} disabled={busy} aria-busy={busy}>
                {busy ? "Preparando…" : props.kind === "unit" ? "Empezar el test" : "Empezar el examen final"}
              </button>
            </div>
          )}
        </div>
      );
    }

    // --- Corrigiendo ---
    if (view.status === "grading") {
      return (
        <div className="card quiz" ref={topRef}>
          <h2 className="mt-0" ref={headRef} tabIndex={-1}>
            Corrigiendo tus respuestas…
          </h2>
          <p className="muted">Estamos evaluando las respuestas escritas. Esto suele tardar unos segundos; puedes cerrar esta página y volver más tarde.</p>
        </div>
      );
    }

    // --- Resultado ---
    if (view.status === "passed" || view.status === "failed") {
      const passed = view.status === "passed";
      return (
        <div ref={topRef} className="quiz">
          <div className="card center">
            <h2 className="mt-0 mb-0" ref={headRef} tabIndex={-1}>
              <span className="sr-only">Resultado: </span>
              <span className={`badge ${passed ? "ok" : "bad"}`}>
                <span aria-hidden="true">{passed ? "✓" : "✗"}</span> <span>{passed ? "Aprobado" : "No aprobado"}</span>
              </span>
              <span className="sr-only">, {view.scorePct} %</span>
            </h2>
            <div className={`big-score ${passed ? "is-ok" : "is-bad"}`} aria-hidden="true" style={{ margin: "0.75rem 0" }}>
              {view.scorePct}%
            </div>
            <p className="muted mb-0">
              {view.correctCount} de {view.totalCount} correctas · necesitas un {view.passPct}%
            </p>
            {passed && view.kind === "final" && view.carnetNumero && (
              <p>
                ¡Enhorabuena! Se ha emitido tu carnet <strong>{view.carnetNumero}</strong>.
              </p>
            )}
            <div className="row" style={{ justifyContent: "center", marginTop: "1rem" }}>
              {passed ? (
                <a className="btn primary" href={props.nextHref} style={{ flex: "1 1 12rem" }}>
                  {props.nextLabel}
                </a>
              ) : (
                <button className="btn primary" onClick={retry} disabled={busy} aria-busy={busy} style={{ flex: "1 1 12rem" }}>
                  Repetir con otras preguntas
                </button>
              )}
              <a className="btn" href={props.backHref} style={{ flex: "1 1 12rem" }}>
                {props.kind === "unit" ? "Repasar el tema" : "Volver"}
              </a>
            </div>
          </div>
          {errorBox}
          {view.review && view.kind === "unit" && <Review items={view.review} />}
          {view.review && view.kind === "final" && (
            <div className="card">
              <h2 className="mt-0">Resultado por pregunta</h2>
              <ol style={{ paddingLeft: "1.2rem" }} className="mb-0">
                {view.review.map((r) => (
                  <li key={r.position} style={{ marginTop: "0.4rem" }}>
                    <span className={`badge ${r.isCorrect ? "ok" : "bad"}`}>
                      <span aria-hidden="true">{r.isCorrect ? "✓" : "✗"}</span>
                      <span className="sr-only">{r.isCorrect ? "Correcta" : "Incorrecta"}</span>
                    </span>{" "}
                    <span className="muted">{r.type === "written" ? "(escrita) " : ""}</span>
                    {r.enunciado}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      );
    }

    // --- Respondiendo ---
    const v = view;
    const items = v.items ?? [];
    const answered = items.length - unanswered;
    return (
      <div ref={topRef} className="quiz">
        <h2 className="sr-only" ref={headRef} tabIndex={-1}>
          {v.kind === "final" ? "Examen" : "Test"}: {items.length} preguntas
        </h2>
        <div className="card quiz-progress">
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <small className="muted" style={{ whiteSpace: "nowrap" }}>
              {answered} de {items.length} respondidas
            </small>
            <div className="progress" aria-hidden="true" style={{ flex: 1 }}>
              <span style={{ width: `${(answered / Math.max(items.length, 1)) * 100}%` }} />
            </div>
          </div>
        </div>
        {props.demo && (
          <div className="card demo-shortcut">
            <p className="mt-0 mb-0 text-sm">
              <strong>Atajo de la demo:</strong> rellena las respuestas con ejemplos (casi todas bien, con algún fallo para ver la corrección).
            </p>
            <button type="button" className="btn small" onClick={fillExample}>
              Rellenar con respuestas de ejemplo
            </button>
          </div>
        )}
        {items.map((it, n) => {
          const legendId = `q-${v.id}-${it.position}`;
          const hintId = `hint-${v.id}-${it.position}`;
          const countId = `count-${v.id}-${it.position}`;
          return (
            <fieldset key={it.position} className="card question" aria-describedby={it.type === "multi" ? hintId : undefined}>
              <legend id={legendId}>
                <span className="qhead">
                  Pregunta {n + 1} de {items.length}
                  {it.type === "written" ? " · respuesta escrita" : it.type === "multi" ? " · varias respuestas" : ""}
                </span>
                <span className="qtext">{it.enunciado}</span>
              </legend>
              {it.type === "multi" ? (
                <>
                  <p className="multi-hint" id={hintId}>
                    Marca todas las respuestas correctas (puede haber una o varias).
                  </p>
                  {it.options!.map((opt, i) => {
                    const cur = (answers[String(it.position)] as number[] | undefined) ?? [];
                    return (
                      <label key={i} className="option">
                        <input
                          type="checkbox"
                          checked={cur.includes(i)}
                          onChange={(e) =>
                            setAnswer(it.position, e.target.checked ? [...cur, i].sort((a, b) => a - b) : cur.filter((x) => x !== i))
                          }
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </>
              ) : it.type === "mc" ? (
                it.options!.map((opt, i) => (
                  <label key={i} className="option">
                    <input
                      type="radio"
                      name={`q${it.position}`}
                      checked={answers[String(it.position)] === i}
                      onChange={() => setAnswer(it.position, i)}
                    />
                    <span>{opt}</span>
                  </label>
                ))
              ) : (
                <>
                  <textarea
                    aria-labelledby={legendId}
                    aria-describedby={countId}
                    enterKeyHint="done"
                    maxLength={MAX_WRITTEN}
                    value={(answers[String(it.position)] as string) ?? ""}
                    onChange={(e) => setAnswer(it.position, e.target.value)}
                    placeholder="Escribe tu respuesta con tus palabras (1–3 frases)"
                  />
                  <small className="muted" id={countId}>
                    {String(answers[String(it.position)] ?? "").length}/{MAX_WRITTEN}
                    <span className="sr-only"> caracteres</span>
                  </small>
                </>
              )}
            </fieldset>
          );
        })}
        {errorBox}
        {confirming && (
          <div className="alert bad" role="status">
            <span aria-hidden="true">⚠</span>
            <span>
              {unanswered === 1 ? "Te falta 1 pregunta" : `Te faltan ${unanswered} preguntas`} por responder; contarán como incorrectas.
              Pulsa de nuevo para enviar igualmente.
            </span>
          </div>
        )}
        <button className="btn primary block" onClick={submit} disabled={busy} aria-busy={busy}>
          {busy ? "Enviando…" : confirming ? "Enviar igualmente" : "Enviar respuestas"}
        </button>
      </div>
    );
  }
}

function Review({ items }: { items: ReviewItem[] }) {
  const failed = items.filter((r) => !r.isCorrect).length;
  const [onlyFailed, setOnlyFailed] = useState(false);
  const shown = items.map((r, n) => ({ r, n })).filter(({ r }) => !onlyFailed || !r.isCorrect);
  return (
    <div>
      <div className="spread" style={{ margin: "1.75rem 0 0.75rem" }}>
        <h2 className="mt-0 mb-0">Repaso</h2>
        {failed > 0 && failed < items.length && (
          <div className="segmented" role="group" aria-label="Filtrar preguntas del repaso">
            <button type="button" aria-pressed={!onlyFailed} onClick={() => setOnlyFailed(false)}>
              Todas ({items.length})
            </button>
            <button type="button" aria-pressed={onlyFailed} onClick={() => setOnlyFailed(true)}>
              Falladas ({failed})
            </button>
          </div>
        )}
      </div>
      {shown.map(({ r, n }) => (
        <div key={r.position} className="card question">
          <div className="qhead">
            Pregunta {n + 1} · <span className={`badge ${r.isCorrect ? "ok" : "bad"}`}>{r.isCorrect ? "Correcta" : "Incorrecta"}</span>
          </div>
          <div className="qtext">{r.enunciado}</div>
          {r.type === "multi"
            ? r.options?.map((opt, i) => {
                const ok = (r.correctIndexes ?? []).includes(i);
                const marked = Array.isArray(r.chosen) && r.chosen.includes(i);
                const cls = ok ? "correct" : marked ? "wrong" : "";
                return (
                  <div key={i} className={`option ${cls}`}>
                    <span aria-hidden="true">{ok ? "✓" : marked ? "✗" : "•"}</span>
                    <span>
                      {ok && <span className="sr-only">Correcta: </span>}
                      {!ok && marked && <span className="sr-only">Incorrecta: </span>}
                      {opt}
                      {marked && <em className="muted"> (marcada)</em>}
                      {ok && !marked && <em className="muted"> (te faltó marcarla)</em>}
                    </span>
                  </div>
                );
              })
            : r.options?.map((opt, i) => {
                const cls = i === r.correctIndex ? "correct" : i === r.chosen ? "wrong" : "";
                return (
                  <div key={i} className={`option ${cls}`}>
                    <span aria-hidden="true">{i === r.correctIndex ? "✓" : i === r.chosen ? "✗" : "•"}</span>
                    <span>
                      {i === r.correctIndex && <span className="sr-only">Respuesta correcta: </span>}
                      {i === r.chosen && i !== r.correctIndex && <span className="sr-only">Respuesta incorrecta: </span>}
                      {opt}
                      {i === r.chosen && <em className="muted"> (tu respuesta)</em>}
                    </span>
                  </div>
                );
              })}
          {r.explicacion && <p className="muted mb-0">{r.explicacion}</p>}
        </div>
      ))}
    </div>
  );
}
