import { useEffect, useState } from "react";
import api from "../../services/api";
export default function Dashboard() {
  const [data, setData] = useState(),
    [logs, setLogs] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    const config = {
      headers: { Authorization: `Bearer ${localStorage.getItem("jls-token")}` },
    };
    Promise.all([api.get("/profile", config), api.get("/history", config)])
      .then(([p, h]) => {
        setData(p.data);
        setLogs(h.data.items);
      })
      .catch(() => setError("Entre na sua conta para acessar o dashboard."));
  }, []);
  if (error)
    return (
      <section className="panel">
        <h1>Dashboard</h1>
        <p className="error">{error}</p>
      </section>
    );
  if (!data) return <section className="panel">Carregando painel…</section>;
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Olá, {data.user.name}</h1>
          <p>Seu espaço para publicar, atualizar e acompanhar bibliotecas.</p>
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <strong>{data.stats.packages}</strong>
          <small>Bibliotecas</small>
        </div>
        <div className="stat">
          <strong>{data.stats.downloads}</strong>
          <small>Downloads</small>
        </div>
        <div className="stat">
          <strong>{logs.length}</strong>
          <small>Atividades</small>
        </div>
      </div>
      <div className="grid">
        <article className="panel">
          <h2>Suas bibliotecas</h2>
          {data.packages.length ? (
            data.packages.map((p) => (
              <p key={p.name}>
                <b>{p.name}</b> — {p.downloads} downloads
              </p>
            ))
          ) : (
            <p className="muted">Nenhuma biblioteca publicada ainda.</p>
          )}
        </article>
        <article className="panel">
          <h2>Histórico</h2>
          {logs.length ? (
            logs.slice(0, 6).map((x, i) => (
              <p key={i}>
                <span className="tag">{x.action}</span> {x.resource}
              </p>
            ))
          ) : (
            <p className="muted">Suas atividades aparecerão aqui.</p>
          )}
        </article>
      </div>
    </section>
  );
}
