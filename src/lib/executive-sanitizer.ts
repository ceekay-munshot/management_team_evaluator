/**
 * Executive name validation and sanitization utilities.
 * Filters out generic role-only names (including composite title phrases),
 * deduplicates, and validates person names.
 */

// Individual role/title tokens that are NOT person names
const ROLE_TOKENS = new Set([
  'chairman', 'chairperson', 'chair', 'executive', 'director', 'independent',
  'managing', 'non-executive', 'nonexecutive', 'nominee', 'whole-time',
  'wholetime', 'board', 'member', 'lead', 'group', 'senior', 'joint',
  'additional', 'alternate', 'associate', 'deputy', 'acting',
  'ceo', 'cfo', 'coo', 'cto', 'chro', 'president', 'officer',
  'chief', 'financial', 'operating', 'technology', 'executive',
  'company', 'secretary', 'general', 'counsel', 'vice',
  'head', 'manager', 'partner', 'treasurer', 'auditor',
  'non', 'the', 'of', 'and', '&',
]);

const HONORIFICS = /^(mr\.?|ms\.?|mrs\.?|dr\.?|shri\.?|smt\.?|ca\.?|prof\.?|sir|justice|hon\.?)\s+/i;

export function stripHonorifics(name: string): string {
  return name.replace(HONORIFICS, '').trim();
}

export function normalizeName(name: string): string {
  return stripHonorifics(name).toLowerCase().replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if a string is composed mostly/entirely of role/title words.
 * This catches composite phrases like "Executive Chairman", "Lead Independent Director", etc.
 */
export function isRoleTitlePhrase(name: string): boolean {
  const cleaned = normalizeName(name);
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return true;

  const roleTokenCount = tokens.filter(t => ROLE_TOKENS.has(t)).length;
  // If ALL tokens are role words, it's a title phrase
  if (roleTokenCount === tokens.length) return true;
  // If all but one are role words and the remaining one is very short (< 3 chars), still likely a title
  if (tokens.length >= 2 && roleTokenCount >= tokens.length - 1) {
    const nonRoleTokens = tokens.filter(t => !ROLE_TOKENS.has(t));
    if (nonRoleTokens.length <= 1 && nonRoleTokens.every(t => t.length < 3)) return true;
  }
  return false;
}

/**
 * A valid person name should have at least one plausible first-name token
 * and at least one plausible surname token, where "plausible" means
 * it's not a known role/title word.
 */
function hasPersonNameStructure(name: string): boolean {
  const cleaned = stripHonorifics(name).trim();
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length < 2) {
    // Single-word names: only accept if >= 5 chars and not a role word
    return tokens.length === 1 && tokens[0].length >= 5 && !ROLE_TOKENS.has(tokens[0].toLowerCase());
  }
  // Must have at least 2 tokens that are NOT role words
  const nonRoleTokens = tokens.filter(t => !ROLE_TOKENS.has(t.toLowerCase()));
  return nonRoleTokens.length >= 2 || 
    // Allow "J. Surname" pattern (initial + surname)
    (nonRoleTokens.length >= 1 && tokens.some(t => /^[A-Z]\.?$/.test(t)));
}

export function isLikelyPersonName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const cleaned = stripHonorifics(name).trim();
  if (cleaned.length < 3) return false;
  if (cleaned.length > 60) return false;
  // Reject all-caps acronyms
  if (/^[A-Z]{2,}$/.test(cleaned)) return false;
  // Must contain letters
  if (!/[a-zA-Z]/.test(cleaned)) return false;
  // Reject if it's a role/title phrase
  if (isRoleTitlePhrase(name)) return false;
  // Must have person-like name structure
  if (!hasPersonNameStructure(name)) return false;
  return true;
}

/**
 * Get a short display label for an executive name.
 * Strips honorifics and returns a readable surname.
 */
export function getShortExecutiveLabel(name: string): string {
  const cleaned = stripHonorifics(name).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0) return name;
  if (parts.length === 1) return parts[0];

  // If middle part is an initial (e.g. "A."), use "Initial. Surname"
  if (parts.length >= 3) {
    const middle = parts.slice(1, -1);
    const surname = parts[parts.length - 1];
    const hasInitials = middle.some(p => /^[A-Z]\.?$/.test(p));
    if (hasInitials) {
      const initials = middle.filter(p => /^[A-Z]\.?$/.test(p)).map(p => p.endsWith('.') ? p : p + '.').join('');
      return `${initials} ${surname}`;
    }
  }

  // Default: return last name
  return parts[parts.length - 1];
}

interface RawExecutive {
  name: string;
  title: string;
  [key: string]: any;
}

/**
 * Sanitize and deduplicate a list of executives.
 * Removes generic role-only names, title phrases, invalid entries, and duplicates.
 */
export function sanitizeExecutives<T extends RawExecutive>(executives: T[]): T[] {
  const seen = new Set<string>();
  return executives.filter(e => {
    if (!e.name || typeof e.name !== 'string') return false;
    if (!isLikelyPersonName(e.name)) return false;

    const normalized = normalizeName(e.name);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Classify whether a title indicates an operating executive vs board-only member.
 */
export function isOperatingExecutiveTitle(title: string): boolean {
  return /\b(ceo|cfo|coo|cto|chro|chief|managing director|company secretary|president|general counsel|head of|vp|vice president|whole[-\s]?time director)\b/i.test(title);
}

export function isBoardOnlyTitle(title: string): boolean {
  if (isOperatingExecutiveTitle(title)) return false;
  return /\b(chairman|chairperson|independent director|non[-\s]?executive|nominee director|director)\b/i.test(title);
}

/**
 * Filter executives to only operating roles (not board-only).
 */
export function filterOperatingExecutives<T extends RawExecutive>(executives: T[]): T[] {
  return executives.filter(e => !isBoardOnlyTitle(e.title));
}

/**
 * Use normalized exact-name matching for score assignment.
 */
export function findExactNameMatch(targetName: string, candidates: Array<{ name: string; [key: string]: any }>): typeof candidates[number] | undefined {
  const normalizedTarget = normalizeName(targetName);

  // Try exact match first
  const exact = candidates.find(c => normalizeName(c.name) === normalizedTarget);
  if (exact) return exact;

  // Try matching by last name + first initial
  const targetParts = normalizedTarget.split(' ');
  if (targetParts.length >= 2) {
    const targetSurname = targetParts[targetParts.length - 1];
    const targetFirst = targetParts[0][0];

    for (const c of candidates) {
      const cParts = normalizeName(c.name).split(' ');
      if (cParts.length >= 2) {
        const cSurname = cParts[cParts.length - 1];
        const cFirst = cParts[0][0];
        if (cSurname === targetSurname && cFirst === targetFirst) return c;
      }
    }
  }

  return undefined;
}
