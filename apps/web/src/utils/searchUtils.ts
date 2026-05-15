export const NODE_TYPE_OPTIONS = [
  { label: 'Page', value: 'CANVAS' },
  { label: 'Instance (Usage)', value: 'INSTANCE' },
  { label: 'Component (Master)', value: 'COMPONENT' },
  { label: 'Variant', value: 'VARIANT' },
  { label: 'Frame', value: 'FRAME' },
  { label: 'Text', value: 'TEXT' },
];

export const formatTypeFilterParams = (url: URL | string, types: string[]) => {
  const newUrl = typeof url === 'string' ? new URL(url) : url;
  if (types.length > 0) {
    types.forEach(t => newUrl.searchParams.append('type', t));
  }
  return newUrl;
};

export const formatRelativeDate = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  return `${Math.floor(diffInSeconds / 31536000)}y ago`;
};

export const getNodesQueryString = (sid: string, types: string[] = []) => {
  let params = `session_id=${sid}`;
  if (types.length > 0) {
    types.forEach(t => params += `&type=${t}`);
  } else {
    params += '&parent_id=null';
  }
  return params;
};

