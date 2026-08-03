import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
export default function Package() {
  const { name } = useParams(),
    nav = useNavigate(),
    { user } = useAuth(),
    [p, setP] = useState(null),
    [confirm, setConfirm] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    api
      .get(`/packages/${name}`)
      .then((r) => setP(r.data))
      .catch((x) =>
        setMessage(x.response?.data?.error || "Pacote não encontrado."),
      );
  }, [name]);
  const remove = async () => {
    try {
      await api.delete(`/packages/${p.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jls-token")}`,
        },
      });
      nav("/dashboard");
    } catch (x) {
      setMessage(x.response?.data?.error || "Não foi possível excluir.");
    }
  };
  if (!p)
    return (
      <section className="panel">{message || "Carregando pacote…"}</section>
    );
  const owner = user?.username === p.author;
  return (
    <article className="panel">
      <div className="page-head">
        <div>
          <h1>
            {p.name} <small>v{p.version}</small>
          </h1>
          <p>{p.description}</p>
          <span className="tag">{p.category || "Geral"}</span>
        </div>
        {owner && (
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => nav("/publish")}
            >
              Nova versão
            </button>
            <button
              className="button secondary"
              onClick={() => nav("/settings")}
            >
              Editar perfil
            </button>
            <button className="button danger" onClick={() => setConfirm(true)}>
              Excluir
            </button>
          </div>
        )}
      </div>
      {message && <p className="error">{message}</p>}
      <pre>{`jls install ${p.name}`}</pre>
      <h2>Versões</h2>
      <div className="grid">
        {p.versions?.map((v) => (
          <div className="card" key={v.version}>
            <b>v{v.version}</b>
            <p className="muted">
              {new Date(v.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: "1.5rem" }}>README</h2>
      <pre>{p.readme || "Sem README publicado."}</pre>
      {confirm && (
        <div className="modal-backdrop" role="dialog">
          <div className="panel modal">
            <h2>Tem certeza?</h2>
            <p>
              Esta ação não poderá ser desfeita. A biblioteca, versões,
              downloads e histórico relacionado serão excluídos.
            </p>
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => setConfirm(false)}
              >
                Cancelar
              </button>
              <button className="button danger" onClick={remove}>
                Excluir biblioteca
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
