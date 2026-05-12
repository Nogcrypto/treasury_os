"use client";
import React, { useEffect, useRef, type ReactNode } from "react";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "blue" | "purple" | "green" | "red" | "orange";
  size?: "sm" | "md" | "lg";
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
}

const glowColorMap = {
  blue:   { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green:  { base: 120, spread: 200 },
  red:    { base: 0,   spread: 200 },
  orange: { base: 30,  spread: 200 },
};

const sizeMap = { sm: "w-48 h-64", md: "w-64 h-80", lg: "w-80 h-96" };

const beforeAfterStyles = `
.glow-card[data-glow]::before,.glow-card[data-glow]::after{pointer-events:none;content:"";position:absolute;inset:calc(var(--border-size)*-1);border:var(--border-size) solid transparent;border-radius:calc(var(--radius)*1px);background-attachment:fixed;background-size:calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)));background-repeat:no-repeat;background-position:50% 50%;mask:linear-gradient(transparent,transparent),linear-gradient(white,white);mask-clip:padding-box,border-box;mask-composite:intersect}
.glow-card[data-glow]::before{background-image:radial-gradient(calc(var(--spotlight-size)*.75) calc(var(--spotlight-size)*.75) at calc(var(--x,0)*1px) calc(var(--y,0)*1px),hsl(var(--hue,210) calc(var(--saturation,100)*1%) calc(var(--lightness,50)*1%)/var(--border-spot-opacity,1)),transparent 100%);filter:brightness(2)}
.glow-card[data-glow]::after{background-image:radial-gradient(calc(var(--spotlight-size)*.5) calc(var(--spotlight-size)*.5) at calc(var(--x,0)*1px) calc(var(--y,0)*1px),hsl(0 100% 100%/var(--border-light-opacity,1)),transparent 100%)}
.glow-card[data-glow]>div[data-glow]{position:absolute;inset:0;will-change:filter;opacity:var(--outer,1);border-radius:calc(var(--radius)*1px);border-width:calc(var(--border-size)*20);filter:blur(calc(var(--border-size)*10));background:none;pointer-events:none;border:none}
`;

const GlowCard: React.FC<GlowCardProps> = ({
  children, className = "", glowColor = "blue", size = "md", width, height, customSize = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e;
      if (cardRef.current) {
        cardRef.current.style.setProperty("--x", x.toFixed(2));
        cardRef.current.style.setProperty("--xp", (x / window.innerWidth).toFixed(2));
        cardRef.current.style.setProperty("--y", y.toFixed(2));
        cardRef.current.style.setProperty("--yp", (y / window.innerHeight).toFixed(2));
      }
    };
    document.addEventListener("pointermove", syncPointer);
    return () => document.removeEventListener("pointermove", syncPointer);
  }, []);

  const { base, spread } = glowColorMap[glowColor];
  const inlineStyles: React.CSSProperties & Record<string, unknown> = {
    "--base": base, "--spread": spread, "--radius": "14", "--border": "1.5",
    "--backdrop": "rgba(0,0,0,0.4)", "--backup-border": "rgba(255,255,255,0.1)",
    "--size": "250", "--outer": "1",
    "--border-size": "calc(var(--border,2)*1px)",
    "--spotlight-size": "calc(var(--size,150)*1px)",
    "--hue": "calc(var(--base)+(var(--xp,0)*var(--spread,0)))",
    backgroundImage: `radial-gradient(var(--spotlight-size) var(--spotlight-size) at calc(var(--x,0)*1px) calc(var(--y,0)*1px),hsl(var(--hue,210) calc(var(--saturation,100)*1%) calc(var(--lightness,70)*1%)/var(--bg-spot-opacity,0.1)),transparent)`,
    backgroundColor: "var(--backdrop,transparent)",
    backgroundSize: "calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))",
    backgroundPosition: "50% 50%", backgroundAttachment: "fixed",
    border: "var(--border-size) solid var(--backup-border)",
    position: "relative", touchAction: "none",
    ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : {}),
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: beforeAfterStyles }} />
      <div
        ref={cardRef} data-glow style={inlineStyles}
        className={`glow-card ${customSize ? "" : sizeMap[size]} ${!customSize ? "aspect-[3/4]" : ""} rounded-2xl relative flex flex-col shadow-[0_1rem_2rem_-1rem_black] p-8 gap-4 backdrop-blur-[5px] ${className}`}
      >
        <div ref={innerRef} data-glow />
        <div className="z-10 h-full w-full">{children}</div>
      </div>
    </>
  );
};

export { GlowCard };
