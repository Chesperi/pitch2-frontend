/**
 * Banner shown only below `md`: dense admin views are usable but optimized for desktop.
 */
export default function DesktopRecommended() {
  return (
    <div
      role="note"
      className="mb-4 rounded-lg border border-pitch-accent/35 bg-pitch-accent/10 px-3 py-2.5 text-xs leading-relaxed text-pitch-gray-light md:hidden"
    >
      <span className="font-medium text-pitch-white">
        Schermo ampio consigliato.
      </span>{" "}
      Questa sezione è pensata soprattutto per desktop: su schermi piccoli consultare e
      modificare i dati può essere difficile. Puoi continuare comunque da mobile.
    </div>
  );
}
