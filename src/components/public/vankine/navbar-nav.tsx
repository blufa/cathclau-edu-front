import Link from "next/link";

/** Menu de navigation, structure/classes identiques au NavbarNav du template (menu déroulant CSS
 * pur), mais avec les vraies pages de CathClau Edu — le template original propose des dizaines de
 * pages de démonstration (Home 1-6, Shop, Team, Portfolio…) qui n'existent pas dans notre produit. */
export function NavbarNav() {
  return (
    <ul className="navbar_nav">
      <li className="menu-item nav-item">
        <Link href="/" className="nav_link"><span className="text-link">Accueil</span></Link>
      </li>
      <li className="menu-item menu-item-has-children dropdown nav-item">
        <Link href="/fonctionnalites" className="nav_link"><span className="text-link">Fonctionnalités</span></Link>
        <ul className="sub_menu">
          <li className="menu-item nav-item"><Link href="/fonctionnalites/scolarite" className="nav_link"><span className="text-link">Scolarité</span></Link></li>
          <li className="menu-item nav-item"><Link href="/fonctionnalites/communication" className="nav_link"><span className="text-link">Communication</span></Link></li>
          <li className="menu-item nav-item"><Link href="/fonctionnalites/facturation" className="nav_link"><span className="text-link">Facturation & paiements</span></Link></li>
          <li className="menu-item nav-item"><Link href="/fonctionnalites/pilotage" className="nav_link"><span className="text-link">Pilotage</span></Link></li>
        </ul>
        <div className="dropdown-btn"><span className="fa fa-angle-down" /></div>
      </li>
      <li className="menu-item nav-item">
        <Link href="/a-propos" className="nav_link"><span className="text-link">À propos</span></Link>
      </li>
      <li className="menu-item nav-item">
        <Link href="/blog" className="nav_link"><span className="text-link">Blog</span></Link>
      </li>
      <li className="menu-item nav-item">
        <Link href="/tarifs" className="nav_link"><span className="text-link">Tarifs</span></Link>
      </li>
      <li className="menu-item nav-item">
        <Link href="/faqs" className="nav_link"><span className="text-link">FAQ</span></Link>
      </li>
      <li className="menu-item nav-item">
        <Link href="/contact" className="nav_link"><span className="text-link">Contact</span></Link>
      </li>
    </ul>
  );
}
