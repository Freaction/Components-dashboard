export const FigmaConfig = {
  BASE_WEB_URL: 'https://www.figma.com',
  BASE_APP_URL: 'figma://file',
};

export const formatNodeIdForUrl = (id: string): string => {
  let clean = id.replace(/^I/, '');
  const parts = clean.split(';');
  clean = parts[0];
  return clean.replace(/:/g, '-');
};

export const figmaSlugify = (t: string): string => t.toString().replace(/[^a-zA-Z0-9]/g, '-');
export const slugify = figmaSlugify;

export const formatDisplayName = (name: string): string => {
  return name.replace(/--+/g, ' / ');
};

export const extractFileKey = (s: string): string => s.match(/(?:file|design)\/([a-zA-Z0-9]+)/)?.[1] || s;
export const extractFileName = (s: string): string | undefined => {
  const match = s.match(/(?:design|file)\/[a-zA-Z0-9]+\/([^?\/]+)/)?.[1];
  return match ? decodeURIComponent(match.replace(/\+/g, ' ')) : undefined;
};

interface FigmaLinkParams { fileKey: string; fileName?: string; nodeId?: string; mode?: 'design' | 'dev'; }

export const generateWebLink = ({ fileKey, fileName, nodeId, mode = 'design' }: FigmaLinkParams): string => {
  const key = extractFileKey(fileKey);
  const slug = fileName ? `/${figmaSlugify(fileName)}` : '';
  let url = `${FigmaConfig.BASE_WEB_URL}/${mode}/${key}${slug}`;
  if (nodeId) url += `?node-id=${formatNodeIdForUrl(nodeId)}`;
  return url;
};

export const generateAppLink = ({ fileKey, fileName, nodeId }: FigmaLinkParams): string => {
  const key = extractFileKey(fileKey);
  const slug = fileName ? `/${figmaSlugify(fileName)}` : '';
  let url = `${FigmaConfig.BASE_APP_URL}/${key}${slug}`;
  if (nodeId) url += `?node-id=${formatNodeIdForUrl(nodeId)}`;
  return url;
};

export const generateFigmaLink = (o: FigmaLinkParams & { isApp?: boolean }): string => o.isApp ? generateAppLink(o) : generateWebLink(o);

export const getBadgeType = (type: string) => {
  const t = type.toUpperCase();
  if (t === 'CANVAS') return 'PAGE';
  if (t === 'COMPONENT' || t === 'COMPONENT_SET') return 'COMPONENT';
  if (t === 'VARIANT') return 'VARIANT';
  if (t === 'INSTANCE') return 'INSTANCE';
  if (t === 'FRAME') return 'FRAME';
  return t;
};

export const getBadgeVariant = (type: string) => {
  const t = type.toUpperCase();
  if (t === 'CANVAS') return 'slate';
  if (t === 'COMPONENT' || t === 'COMPONENT_SET') return 'violet';
  if (t === 'VARIANT') return 'violet';
  if (t === 'INSTANCE') return 'primary';
  if (t === 'FRAME' || t === 'GROUP') return 'secondary';
  return 'slate';
};