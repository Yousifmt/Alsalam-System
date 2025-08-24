// src/app/api/students/route.ts
import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase"; // must export a Firestore instance

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const snap = await getDocs(collection(db, "users")); // change if your collection is different
    const students = snap.docs.map((d) => {
      const data = d.data() as any;
      // prefer data.uid, else fall back to doc id
      const uid = data.uid ?? d.id;
      return {
        uid,
        name: data.name ?? "",
        email: data.email ?? "",
        classId: data.classId ?? null,
        className: data.className ?? null,
      };
    });

    return NextResponse.json(
      { ok: true, students },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/students] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load students." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
