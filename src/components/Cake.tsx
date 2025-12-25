type CakeProps = {
  size?: number | string;
  color?: string;
};

export default function Cake({ size = 220, color = '#F6C7A1' }: CakeProps) {
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' fill='white'/></svg>";
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  const sizePx = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className="cake"
      style={{ width: sizePx, height: sizePx, ['--cake-color' as any]: color }}
      role="img"
      aria-label="Cake"
    >
      <div className="cake-highlight" />
      <div
        className="cake-texture"
        style={{ backgroundImage: `url("${dataUri}")` }}
        aria-hidden="true"
      />
    </div>
  );
}
