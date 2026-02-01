/**
 * 🚀 CONTTA DESIGN SYSTEM - LANDING LAYOUT
 * 
 * Layout premium para páginas públicas/marketing
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/design-system/components";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
export interface LandingLayoutProps {
  children: React.ReactNode;
  /** Mostrar header */
  showHeader?: boolean;
  /** Mostrar footer */
  showFooter?: boolean;
  /** Itens de navegação customizados */
  navItems?: NavItem[];
  /** Classe adicional */
  className?: string;
}

export interface NavItem {
  label: string;
  href: string;
  isExternal?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 DEFAULT NAV ITEMS
// ═══════════════════════════════════════════════════════════════
const defaultNavItems: NavItem[] = [
  { label: "Recursos", href: "#recursos" },
  { label: "Dr. Cícero", href: "#dr-cicero" },
  { label: "Planos", href: "#planos" },
  { label: "Contato", href: "#contato" },
];

// ═══════════════════════════════════════════════════════════════
// 🏠 LANDING LAYOUT
// ═══════════════════════════════════════════════════════════════
export const LandingLayout: React.FC<LandingLayoutProps> = ({
  children,
  showHeader = true,
  showFooter = true,
  navItems = defaultNavItems,
  className,
}) => {
  return (
    <div className={cn("min-h-screen bg-white", className)}>
      {showHeader && <LandingHeader navItems={navItems} />}
      <main>{children}</main>
      {showFooter && <LandingFooter />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📍 HEADER
// ═══════════════════════════════════════════════════════════════
interface LandingHeaderProps {
  navItems: NavItem[];
}

const LandingHeader: React.FC<LandingHeaderProps> = ({ navItems }) => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-100">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Maestro UX: h-12 destaque no header */}
          <Link to="/" className="flex items-center shrink-0">
            <img 
              src="/logo-contta.png" 
              alt="Contta" 
              className="h-12 w-auto"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-neutral-600 hover:text-primary-600 transition-colors"
                {...(item.isExternal && { target: "_blank", rel: "noopener noreferrer" })}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
            >
              Entrar
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate("/auth?mode=signup")}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Começar Grátis
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-neutral-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-100">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="block py-2 text-neutral-600 hover:text-primary-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => navigate("/auth")}
              >
                Entrar
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate("/auth?mode=signup")}
              >
                Começar Grátis
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// ═══════════════════════════════════════════════════════════════
// 🦶 FOOTER
// ═══════════════════════════════════════════════════════════════
const LandingFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    produto: [
      { label: "Recursos", href: "#recursos" },
      { label: "Planos", href: "#planos" },
      { label: "Changelog", href: "#" },
      { label: "Roadmap", href: "#" },
    ],
    empresa: [
      { label: "Sobre", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Carreiras", href: "#" },
      { label: "Contato", href: "#contato" },
    ],
    legal: [
      { label: "Privacidade", href: "#" },
      { label: "Termos de Uso", href: "#" },
      { label: "LGPD", href: "#" },
    ],
  };

  return (
    <footer className="bg-neutral-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand - Maestro UX: Logo destaque no footer */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <img 
                src="/logo-contta.png" 
                alt="Contta" 
                className="h-12 w-auto brightness-0 invert"
              />
            </div>
            <p className="text-sm text-neutral-400 mb-4">
              Plataforma financeira com governança por IA para escritórios contábeis e empresas.
            </p>
            <p className="text-xs text-neutral-500">
              CNPJ: XX.XXX.XXX/0001-XX
            </p>
          </div>

          {/* Links - Produto */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Produto</h4>
            <ul className="space-y-2">
              {footerLinks.produto.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Links - Empresa */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Empresa</h4>
            <ul className="space-y-2">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Links - Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-neutral-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-neutral-500">
            © {currentYear} Contta - Inteligência Fiscal. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            {/* Social icons placeholder */}
            <a href="#" className="text-neutral-400 hover:text-white transition-colors">
              <span className="sr-only">LinkedIn</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
            <a href="#" className="text-neutral-400 hover:text-white transition-colors">
              <span className="sr-only">Instagram</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ═══════════════════════════════════════════════════════════════
// 📦 LANDING SECTION HELPERS
// ═══════════════════════════════════════════════════════════════
export interface LandingSectionProps {
  children: React.ReactNode;
  /** ID para navegação por âncora */
  id?: string;
  /** Cor de fundo */
  bg?: "white" | "gray" | "primary" | "dark";
  /** Padding vertical */
  padding?: "sm" | "md" | "lg" | "xl";
  /** Classe adicional */
  className?: string;
}

const bgClasses = {
  white: "bg-white",
  gray: "bg-neutral-50",
  primary: "bg-primary-600 text-white",
  dark: "bg-neutral-900 text-white",
};

const paddingYClasses = {
  sm: "py-12",
  md: "py-16",
  lg: "py-20",
  xl: "py-24",
};

export const LandingSection: React.FC<LandingSectionProps> = ({
  children,
  id,
  bg = "white",
  padding = "lg",
  className,
}) => {
  return (
    <section
      id={id}
      className={cn(
        bgClasses[bg],
        paddingYClasses[padding],
        className
      )}
    >
      <div className="container mx-auto px-4 sm:px-6">
        {children}
      </div>
    </section>
  );
};

// Section Header
export interface SectionHeaderProps {
  /** Badge/tag acima do título */
  badge?: string;
  /** Título principal */
  title: string;
  /** Subtítulo/descrição */
  subtitle?: string;
  /** Alinhamento */
  align?: "left" | "center";
  /** Classe adicional */
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  badge,
  title,
  subtitle,
  align = "center",
  className,
}) => {
  return (
    <div className={cn(
      "max-w-3xl mb-12",
      align === "center" && "mx-auto text-center",
      className
    )}>
      {badge && (
        <span className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-wider uppercase bg-primary-100 text-primary-700 rounded-full">
          {badge}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg text-neutral-600">
          {subtitle}
        </p>
      )}
    </div>
  );
};
