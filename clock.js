/*exported Clock */
const Clock = (() => {
  const defaultStyle = {
    timeOffset: 0,
    face: {
      color: "#DDDDDD",
      fontWeight: "normal",
      fontFamily: "monospace",
      fontColor: "#000000",
      fontSize: "8%",
      fontPosition: "85%",
      numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      backgroundImage: null,
      backgroundImageSize: "60%",
    },
    cap: {
      size: "2%",
      color: "#000000",
    },
    hands: {
      hour: {
        display: true,
        capStyle: "round",
        color: "#000000",
        width: "3%",
        length: "50%",
      },
      minute: {
        display: true,
        capStyle: "round",
        color: "#000000",
        width: "2%",
        length: "70%",
      },
      second: {
        display: true,
        capStyle: "butt",
        color: "#FF0000",
        width: "1%",
        length: "75%",
      },
    },
  };

  const range = function* (min, max, step = 1) {
    if (max === undefined) {
      max = min;
      min = 1;
    }

    let iteration = min;
    while (iteration <= max) {
      yield iteration;
      iteration += step;
    }
  };

  const deepMerge = (...objects) => {
    let result = {};

    const mergeAll = (acc, ...objects) => objects.forEach(
      (object) => Object.keys(object)
        .forEach((key) => {
          if (object[key] !== null &&
              object[key] !== undefined &&
              Object.is(Object.getPrototypeOf(object[key]),
                        Object.prototype)) {
            acc[key] = {};
            mergeAll(acc[key],
                     ...objects.map((object) => (object[key] === undefined)
                                    ? {}
                                    : object[key]));
          } else {
            acc[key] = object[key];
          }
        }));

    mergeAll(result, ...objects);

    return result;
  };

  const timeWithOffset = (offset) =>
        new Date((new Date()).valueOf() + offset);

  const objForEach = (obj, func) =>
        Object.entries(obj).forEach(([key, value]) => func(value, key, obj));

  const clearCanvas = (canvas) => {
    const {width, height} = canvas,
          ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
  };

  const copyCanvas = (src, dest) => {
    let ctxsrc  = src.getContext("2d"),
        ctxdest = dest.getContext("2d");
    ctxdest.putImageData(
      ctxsrc.getImageData(0, 0, src.width, src.height),
      0, 0);
  };

  const parseSize = (string, size) =>
        [[/%$/,               (string) => parseFloat(string) * 0.01 * size],
         [/px$/,              (string) => parseInt(string, 10)],
         [{test: () => true}, (string) => {
           throw new Error(`Unknown size format "${string}"`);
         }]]
        .find(([regexp]) => regexp.test(string))[1](string);

  // set up an Array of all clocks and event listeners
  let clocks = [];
  window.addEventListener("resize",
                          () => clocks.forEach((clock) => clock.redraw()));
  window.setInterval(() => clocks.forEach((clock) => clock.tick()), 1000);

  // function is used to allow instantiating with new
  return function (container, style = {}) {
    const createCanvas = () => document.createElement("canvas");
    let canvases = {
      face:  createCanvas(),
      clock: createCanvas(),
    };
    container.appendChild(canvases.clock);

    if (!(style instanceof Object)) {
      throw new Error("style is not an Object");
    }

    style = deepMerge(defaultStyle, style);
    style.face.numbers = new Set(style.face.numbers);

    const updateSizes = () => {
      const size = Math.min(...["offsetWidth", "offsetHeight"]
                            .map((prop) => container[prop]));
      objForEach(canvases, (canvas) => {
        canvas.width  = size;
        canvas.height = size;
      });
    };

    const drawCap = () => {
      const canvas = canvases.clock,
            size = canvas.width,
            center = size / 2,
            ctx = canvas.getContext("2d");

      ctx.beginPath();
      ctx.fillStyle = style.cap.color;
      ctx.strokeStyle = style.cap.color;

      ctx.arc(center, center,
              parseSize(style.cap.size, size),
              0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    };

    const drawFace = () => {
      const canvas = canvases.face,
            size = canvas.width,
            center = size / 2,
            ctx = canvas.getContext("2d");

      clearCanvas(canvas);

      // face background
      ctx.beginPath();
      ctx.fillStyle = style.face.color;
      ctx.strokeStyle = style.face.color;
      ctx.arc(center, center,
              size / 2,
              0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      // face image
      if (style.face.backgroundImage !== null) {
        const image = style.face.backgroundImage;
        if (image.tagName === "IMG") {
          if (image.complete === true) {
            const imageSize =
                  parseSize(style.face.backgroundImageSize, size),
                  position = (size - imageSize) / 2;
            ctx.drawImage(image,
                          position, position,
                          imageSize, imageSize);
          } else {
            // redraw the face after image was loaded
            image.addEventListener("load", drawFace);
          }
        } else {
          throw new Error("Passed background element isn't an <img>");
        }
      }

      // numbers
      const fontSize = parseSize(style.face.fontSize, size);
      ctx.fillStyle = style.face.fontColor;
      ctx.font = `${style.face.fontWeight} \
${fontSize}px \
${style.face.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontPosition = parseSize(style.face.fontPosition, size / 2);
      for (const number of range(1, 12)) {
        if (style.face.numbers.has(number)) {
          const angle = number * (Math.PI / 6) - (Math.PI / 2);
          ctx.fillText(number.toString(10),
                       center + (fontPosition * Math.cos(angle)),
                       center + (fontPosition * Math.sin(angle)));
        }
      }
    };

    const drawHand = (angle, style) => {
      const canvas = canvases.clock,
            size = canvas.width,
            center = size / 2,
            ctx = canvas.getContext("2d");

      const length = parseSize(style.length, center);

      ctx.beginPath();
      ctx.lineWidth = parseSize(style.width, center);
      ctx.lineCap = style.capStyle;
      ctx.strokeStyle = style.color;
      ctx.moveTo(center, center);
      ctx.lineTo(center + (length * Math.cos(angle)),
                 center + (length * Math.sin(angle)));
      ctx.stroke();
      ctx.closePath();
    };

    const tick = (time = timeWithOffset(style.timeOffset)) => {
      clearCanvas(canvases.clock);
      copyCanvas(canvases.face, canvases.clock);

      const numbers = {
        hour:   time.getHours() % 12,
        minute: time.getMinutes(),
        second: time.getSeconds(),
      };

      const angles = {
        hour: ((numbers.hour +
                (numbers.minute / 60) + (numbers.second / (60 ** 2)))
               * (Math.PI / 6)) - Math.PI / 2,
        minute: ((numbers.minute + (numbers.second / 60)) * (Math.PI / 30)) -
          Math.PI / 2,
        second: (numbers.second * (Math.PI / 30)) - Math.PI / 2,
      };

      ["second", "minute", "hour"].forEach(
        (handName) => drawHand(angles[handName],
                               style.hands[handName]));

      drawCap();
    };

    const redraw = () => window.requestAnimationFrame(() => {
      updateSizes();
      drawFace();
      tick();
    });

    redraw();

    const internalObj = {tick, redraw};


    const destroy = () => {
      Object.values(canvases)
        .forEach((canvas) => canvas.remove());
      clocks.splice(clocks.indexOf(internalObj), 1);
    };

    clocks.push(internalObj);

    // this is necessary to have a working Proxy for nested Objects
    const makeProxy = (obj) => new Proxy(obj, {
      get: (obj, prop) => {
        const result = obj[prop];
        if (typeof result === "object" && result !== null) {
          return makeProxy(result);
        } else {
          return result;
        }
      },
      set: (obj, prop, value) => {
        obj[prop] = value;
        redraw();
        return value;
      },
    });

    return {
      style: makeProxy(style),
      destroy,
    };
  };
})();
