import { useEffect, useState } from "react";
import api from "../../services/api";
export default function SupportSettings() {
  const [form, setForm] = useState(null),
    [message, setMessage] = useState("");
  const config = {
    headers: { Authorization: `Bearer ${localStorage.getItem("jls-token")}` },
  };
  useEffect(() => {
    api
      .get("/support/config", config)
      .then((r) => setForm(r.data.items))
      .catch((x) =>
        setMessage(
          x.response?.data?.error ||
            "Não foi possível acessar as configurações.",
        ),
      );
  }, []);
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put("/support/config", form, config);
      setMessage("Configurações salvas.");
    } catch (x) {
      setMessage(x.response?.data?.error || "Erro ao salvar.");
    }
  };
  if (!form)
    return (
      <section className="panel">
        <h1>Configuração do suporte</h1>
        <p className="error">{message || "Carregando…"}</p>
      </section>
    );
  return (
    <section className="auth-wrap">
      <div className="panel">
        <h1>Configuração do suporte</h1>
        <p className="muted">
          Apenas o administrador definido em <code>ADMIN_EMAIL</code> possui
          acesso.
        </p>
        <form onSubmit={save}>
          {[
            ["support_email", "E-mail de suporte"],
            ["support_initial_message", "Mensagem inicial"],
            ["support_hours", "Horário de atendimento"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              {key === "support_initial_message" ? (
                <textarea
                  value={form[key] || ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <input
                  value={form[key] || ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <button className="button">Salvar</button>
          {message && <p className="success">{message}</p>}
        </form>
      </div>
    </section>
  );
}
