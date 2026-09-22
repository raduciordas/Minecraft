export const ZONE_PHASES: Record<string, number> = {
  vatra: 1,
  munte: 2,
  lunca: 3,
  bucla: 4,
  padurea: 5,
  straja: 6,
  stana: 7,
  targ: 8,
};

export function numberedZoneName(zoneId: string, name: string): string {
  const phase = ZONE_PHASES[zoneId];
  return phase ? `${phase}. ${name}` : name;
}

export function mapZoneName(zoneId: string, guide: string): string {
  return numberedZoneName(zoneId, guide.replace(/^\S+\s/, ''));
}

