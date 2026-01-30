export function getDefaultBlockLabel(data: {
  datasetLabel?: string;
}) {
  return data.datasetLabel || 'Select dataset';
}
