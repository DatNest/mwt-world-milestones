/**
 * Opt-in, general-purpose world milestone sequencing.
 *
 * Only arcs with leading episode codes, e.g. S1E02, S2E01, S3E11,
 * participate. All other arcs and NPC relationships remain independent.
 * This module has no writes, DOM, API, or SillyTavern dependencies.
 */

export function episodeCode(arc) {
    const match = /^S(\d{1,3})E(\d{1,3})(?!\d)(?:\b|\s|\s*[-—:])/i.exec(String(arc?.title || '').trim());
    if (!match) return null;
    const season = Number(match[1]);
    const episode = Number(match[2]);
    if (!season || !episode) return null;
    return { code: `S${season}E${String(episode).padStart(2, '0')}`, season, episode };
}

const byChronology = (a, b) => a.episode.season - b.episode.season || a.episode.episode - b.episode.episode;

/**
 * Find ONE parked episode eligible for activation. A predecessor must be an
 * unequivocally resolved episode; dropped, pending and parked do not qualify.
 * Skipping a missing episode within a season is forbidden.
 * At a season boundary, the last recorded episode of the previous season is
 * the predecessor; the user is expected to import a complete season plan.
 * Duplicate episode codes are ambiguous and remain untouched.
 */
export function nextAutomaticMilestone(arcs) {
    const items = (Array.isArray(arcs) ? arcs : [])
        .map(arc => ({ arc, episode: episodeCode(arc) }))
        .filter(item => item.episode)
        .sort(byChronology);
    const counts = new Map();
    const byCode = new Map();
    for (const item of items) {
        const key = item.episode.code;
        counts.set(key, (counts.get(key) || 0) + 1);
        byCode.set(key, item);
    }
    // Do not try to advance the season while an earlier episode is still
    // playing. This also blocks two milestones being active simultaneously.
    if (items.some(item => item.arc.status === 'active')) return null;
    for (const item of items) {
        const { arc, episode } = item;
        if (arc.status !== 'parked' || counts.get(episode.code) !== 1) continue;
        let predecessor;
        if (episode.episode > 1) {
            const prev = `S${episode.season}E${String(episode.episode - 1).padStart(2, '0')}`;
            predecessor = byCode.get(prev);
        } else if (episode.season > 1) {
            const prior = items.filter(entry => entry.episode.season === episode.season - 1);
            predecessor = prior.at(-1);
        }
        if (!predecessor || counts.get(predecessor.episode.code) !== 1) continue;
        if (predecessor.arc.status !== 'resolved') continue;
        // Earlier unresolved world episodes block jumping ahead to a sequel.
        if (items.some(other => byChronology(other, item) < 0 && other.arc.status !== 'resolved')) continue;
        return arc.id;
    }
    return null;
}

export function isActiveWorldMilestone(arc) {
    return !!episodeCode(arc) && arc?.status === 'active';
}
