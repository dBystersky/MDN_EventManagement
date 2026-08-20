interface TagProps {
  name: string;
}

export function ResourceTypeTag({ name }: TagProps) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
      {name}
    </span>
  );
}

