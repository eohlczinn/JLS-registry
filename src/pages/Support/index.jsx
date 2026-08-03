import { useState } from "react";
import api from "../../services/api";
export default function Support() {
  const [f, setF] = useState({}),
    [message, setMessage] = useState(""),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState("");
  const ask = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post("/support/ask", { question });
      setAnswer(r.data.answer);
    } catch (x) {
      setAnswer(
        x.response?.data?.error || "Não foi possível consultar a JLAI.",
      );
    }
  };
  const send = async (e) => {
    e.preventDefault();
    try {
      await api.post("/support", f, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jls-token")}`,
        },
      });
      setMessage("Chamado enviado com sucesso.");
    } catch (x) {
      setMessage(
        x.response?.data?.error || "Entre na conta para abrir um chamado.",
      );
    }
  };
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Central de suporte</h1>
          <p>Pergunte à JLAI ou envie um chamado para a equipe.</p>
        </div>
      </div>
      <div className="grid">
        <article className="card">
          <h2>Documentação</h2>
          <p>Guias da CLI, publicação e formato de pacotes.</p>
        </article>
        <article className="card">
          <h2>JLAI</h2>
          <p>Ajuda rápida sobre terminal, bibliotecas e erros.</p>
        </article>
        <article className="card">
          <h2>GitHub</h2>
          <p>Reporte bugs e acompanhe o ecossistema.</p>
        </article>
      </div>
      <div className="grid" style={{ marginTop: "1rem" }}>
        <div className="panel">
          <h2>Perguntar à JLAI</h2>
          <form onSubmit={ask}>
            <label>
              Sua dúvida
              <input
                required
                value={question}
                placeholder="Como publicar uma biblioteca?"
                onChange={(e) => setQuestion(e.target.value)}
              />
            </label>
            <button className="button">Perguntar</button>
          </form>
          {answer && <p className="muted">{answer}</p>}
        </div>
        <div className="panel">
          <h2>Abrir chamado</h2>
          <form onSubmit={send}>
            <label>
              Assunto
              <input
                required
                onChange={(e) => setF({ ...f, subject: e.target.value })}
              />
            </label>
            <label>
              Como podemos ajudar?
              <textarea
                required
                onChange={(e) => setF({ ...f, message: e.target.value })}
              />
            </label>
            <button className="button">Enviar chamado</button>
            {message && (
              <p
                className={message.startsWith("Chamado") ? "success" : "error"}
              >
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
