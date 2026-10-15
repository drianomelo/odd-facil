const fullBodyImages = ['/players/jogador-1.png', '/players/jogador-2.png'];

export function PlayerSpotlight() {
  return (
    <div aria-hidden="true" className="player-spotlight relative h-full min-h-[50vh] w-full lg:min-h-full">
      <div className="absolute inset-x-[8%] bottom-0 top-[12%] bg-[radial-gradient(ellipse_at_50%_80%,rgba(255,255,255,0.18),transparent_68%)]" />
      {fullBodyImages.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`player-spotlight-image player-spotlight-image-${index} absolute inset-x-0 bottom-0 mx-auto h-[96%] max-h-[850px] w-full object-contain object-bottom`}
        />
      ))}
    </div>
  );
}
