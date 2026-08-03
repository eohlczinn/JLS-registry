import { useState } from "react";
import api from "../../services/api";
export default function Publish() {
  const [f, setF] = useState({ license: "MIT", dependencies: "[]" }),
    [m, setM] = useState("");
  const send = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post(
        "/packages/publish",
        { ...f, dependencies: JSON.parse(f.dependencies || "[]") },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jls-token")}`,
          },
        },
      );
      setM(`Publicado: ${r.data.name} v${r.data.version}`);
    } catch (x) {
      setM(x.response?.data?.error || "Erro ao publicar.");
    }
  };
  return (
    <section className="panel">
      <h1>Publicar biblioteca</h1>
      <form onSubmit={send}>
        {["name", "version", "description", "license"].map((k) => (
          <input
            key={k}
            placeholder={k}
            value={f[k] || ""}
            onChange={(e) => setF({ ...f, [k]: e.target.value })}
          />
        ))}
        <textarea
          placeholder="README e código com class Pack"
          onChange={(e) => setF({ ...f, readme: e.target.value })}
        />
        <input
          placeholder="Dependências JSON"
          value={f.dependencies}
          onChange={(e) => setF({ ...f, dependencies: e.target.value })}
        />
        <button className="button">Validar e publicar</button>
      </form>
      <p>{m}</p>
    </section>
  );
}
