import Link from "next/link";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Domaca kuhinja</span>
          <h1>Planiraj obroke, cuvaj recepte i kuvaj ono sto vec imas.</h1>
          <p>
            Moja Kuhinja je mesto za jednostavne domace recepte na srpskom
            jeziku. Pregledaj ideje za rucak, sacuvaj svoje recepte i pronadji
            jelo prema namirnicama koje imas u frizideru.
          </p>
          <div className={styles.heroActions}>
            <Link href="/recipes">Pogledaj recepte</Link>
            <Link href="/find">Pronadji po namirnicama</Link>
          </div>
        </div>
      </section>

      <section className={styles.featureGrid}>
        <article>
          <h2>Recepti za svaki dan</h2>
          <p>Kratak pregled recepata je javan, a detalji su dostupni nakon prijave.</p>
        </article>
        <article>
          <h2>Pretraga po namirnicama</h2>
          <p>Unesi piletinu, pirinac, papriku ili bilo sta sto imas kod kuce.</p>
        </article>
        <article>
          <h2>Tvoja mala sveska</h2>
          <p>Dodaj recepte i vidi sve sto si uneo na svom profilu.</p>
        </article>
      </section>
    </main>
  );
}
