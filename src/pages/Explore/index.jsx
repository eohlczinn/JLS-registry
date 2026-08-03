import { useEffect, useState } from "react";
import api from "../../services/api";
import PackageCard from "../../components/PackageCard";
export default function Explore() {
  const [q, setQ] = useState("");
  const [packs, setPacks] = useState([]);
  useEffect(() => {
    api
      .get("/packages", { params: { q } })
      .then((r) => setPacks(r.data.items))
      .catch(() => setPacks([]));
  }, [q]);
  return (
    <section>
      <h1>Explorar bibliotecas</h1>
      <input
        aria-label="Pesquisar bibliotecas"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nome, autor ou categoria"
      />
      <div className="grid">
        {packs.map((p) => (
          <PackageCard key={p.name} pkg={p} />
        ))}
      </div>
      {!packs.length && <p>Nenhuma biblioteca encontrada.</p>}
    </section>
  );
}
