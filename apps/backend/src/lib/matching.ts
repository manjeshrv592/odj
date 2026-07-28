import { sql } from "drizzle-orm";
import { db } from "../db";

/** Earth radius in km (Haversine). */
const EARTH_KM = 6371;

/** Fixed search radius for the MVP (see FEATURES §4). */
export const DEFAULT_RADIUS_KM = 15;

export interface EligibleWorker {
  workerProfileId: string;
  userId: string;
  distanceKm: number;
}

/** Great-circle distance in km between two lat/lng points (Haversine). */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Workers eligible for a job offer: **approved** + **online** + hold the
 * profession + have a stored location + **not off today** (no `worker_days_off`
 * row for today scoped to all-professions or this profession) + within
 * `radiusKm` (Haversine) of `(lat,lng)`. Nearest first.
 */
export async function findEligibleWorkers(
  professionId: string,
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<EligibleWorker[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (server local)
  const res = await db.execute(sql`
    SELECT worker_profile_id, user_id, distance_km FROM (
      SELECT
        wp.id AS worker_profile_id,
        wp.user_id AS user_id,
        (${EARTH_KM} * acos(LEAST(1.0,
          cos(radians(${lat})) * cos(radians(wp.lat)) * cos(radians(wp.lng) - radians(${lng}))
          + sin(radians(${lat})) * sin(radians(wp.lat))
        ))) AS distance_km
      FROM worker_profiles wp
      JOIN worker_professions wpr
        ON wpr.worker_profile_id = wp.id AND wpr.profession_id = ${professionId}
      WHERE wp.status = 'approved'
        AND wp.is_online = true
        AND wp.lat IS NOT NULL AND wp.lng IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM worker_days_off wdo
          WHERE wdo.worker_profile_id = wp.id
            AND wdo.date = ${today}
            AND (wdo.profession_id IS NULL OR wdo.profession_id = ${professionId})
        )
    ) t
    WHERE t.distance_km <= ${radiusKm}
    ORDER BY t.distance_km ASC
    LIMIT 50
  `);

  const rows = res.rows as Array<{
    worker_profile_id: string;
    user_id: string;
    distance_km: number;
  }>;
  return rows.map((r) => ({
    workerProfileId: r.worker_profile_id,
    userId: r.user_id,
    distanceKm: Number(r.distance_km),
  }));
}
