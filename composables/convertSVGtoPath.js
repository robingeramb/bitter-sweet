function parseSVGPath(d) {
  const shape = new THREE.Shape();
  const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g); // Trenne Befehle mit ihren Werten
  let currentPoint = { x: 0, y: 0 };

  commands.forEach((command) => {
    const type = command.charAt(0);
    const values = command
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    switch (type) {
      case "M": // MoveTo (absolute)
        shape.moveTo(values[0], values[1]);
        currentPoint = { x: values[0], y: values[1] };
        break;
      case "L": // LineTo (absolute)
        shape.lineTo(values[0], values[1]);
        currentPoint = { x: values[0], y: values[1] };
        break;
      case "Q": // Quadratic Curve
        shape.quadraticCurveTo(values[0], values[1], values[2], values[3]);
        currentPoint = { x: values[2], y: values[3] };
        break;
      case "C": // Cubic Bezier Curve
        shape.bezierCurveTo(
          values[0],
          values[1],
          values[2],
          values[3],
          values[4],
          values[5]
        );
        currentPoint = { x: values[4], y: values[5] };
        break;
      case "Z": // Close Path
        shape.closePath();
        break;
      default:
        console.warn(`SVG-Befehl "${type}" wird nicht unterstützt.`);
    }
  });

  return shape;
}

export function convertSVGtoThree(svgString) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
  const pathElements = svgDoc.querySelectorAll("path");

  const shapes = [];

  pathElements.forEach((path) => {
    const d = path.getAttribute("d");
    if (d) {
      shapes.push(parseSVGPath(d));
    }
  });

  return shapes;
}
