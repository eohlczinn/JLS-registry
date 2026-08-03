import { Link } from "react-router-dom";
import PackageCard from "../../components/PackageCard";
const featured = [
  {
    name: "math",
    version: "1.0.0",
    author: "JLScript",
    description: "Cálculos, estatística e matrizes.",
    downloads: 0,
    category: "Dados",
  },
  {
    name: "watch",
    version: "1.0.0",
    author: "JLScript",
    description: "Monitoramento estruturado de fontes públicas.",
    downloads: 0,
    category: "Web e APIs",
  },
];
export default function Home() {
  return (
    <>
      <section className="hero">
        <span>REGISTRO OFICIAL</span>
        <h1>
          Bibliotecas para a <em>JLScript</em>.
        </h1>
        <p>
          Publique, descubra e instale pacotes da comunidade com uma experiência
          simples.
        </p>
        <div className="actions">
          <Link className="button" to="/explore">
            Explorar bibliotecas
          </Link>
          <Link className="button secondary" to="/publish">
            Publicar biblioteca
          </Link>
        </div>
      </section>
      <h2>Em destaque</h2>
      <div className="grid">
        {featured.map((p) => (
          <PackageCard key={p.name} pkg={p} />
        ))}
      </div>
    </>
  );
}
