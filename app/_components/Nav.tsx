import Link from "next/link";

const links = [
  { href: "/", label: "Overview" },
  { href: "/flows", label: "Flows" },
  { href: "/calculator", label: "Calculator" },
  { href: "/routes", label: "Routes" },
];

export function Nav() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          cargrid
        </Link>
        <ul className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
