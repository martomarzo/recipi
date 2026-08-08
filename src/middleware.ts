import { NextRequest, NextResponse } from "next/server";

// Solo comprueba la presencia de la cookie (la validez real se verifica en
// servidor con getSessionUser — aquí no hay acceso a la DB por ser edge).
const PUBLIC_PATHS = ["/login", "/registro", "/api/auth", "/manifest.webmanifest", "/sw.js", "/iconos", "/uploads"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const hasSession = request.cookies.has("protocolo_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:png|jpg|svg|webp|ico)).*)"],
};
