import { NextResponse } from "next/server";

const isAllowedUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();

    const allowedHosts = [
      "drive.google.com",
      "docs.google.com",
      "lh3.googleusercontent.com",
      "lh4.googleusercontent.com",
      "lh5.googleusercontent.com",
      "lh6.googleusercontent.com",
    ];

    return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";

  if (!url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: "Invalid or disallowed url" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed (${upstream.status})` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Upstream returned HTML (likely permission/login page)" },
        { status: 403 }
      );
    }

    const arrayBuffer = await upstream.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Proxy fetch failed" }, { status: 500 });
  }
}