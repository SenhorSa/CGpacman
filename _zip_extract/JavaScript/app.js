var canvas = document.createElement('canvas');

canvas.width = window.innerWidth - 15;
canvas.height = window.innerHeight - 100;

var GL = canvas.getContext('webgl');

var vertexShader = GL.createShader(GL.VERTEX_SHADER);

var fragmentShader = GL.createShader(GL.FRAGMENT_SHADER);

var program = GL.createProgram();

var gpuArrayBuffer = GL.createBuffer();

var finalMatrixLocation

var anguloDeRotacao = 0;

var visualizationMatrixLocation;

var projectionMatrixLocation;

var viewportMatrixLocation;

var vertexPosition;

var vertexIndex;

var gpuIndexBuffer = GL.createBuffer();

var boxTexture = GL.createTexture();


function PrepareCanvas() {
    GL.clearColor(0.65, 0.65, 0.65, 1.0);

    GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    GL.enable(GL.DEPTH_TEST);

    GL.enable(GL.CULL_FACE);

    document.body.appendChild(canvas);

    canvas.insertAdjacentText('afterend', 'O canvas encontra-se acima deste texto!');
}



function PrepareShaders() 
{
    GL.shaderSource(vertexShader, codigoVertexShader);
    GL.shaderSource(fragmentShader, codigoFragmentShader);

    GL.compileShader(vertexShader);
    GL.compileShader(fragmentShader);

    if (!GL.getShaderParameter(vertexShader, GL.COMPILE_STATUS)) {
        console.error("ERRO :: A compilação do vertex shader lançou uma excepção!", GL.getShaderInfoLog(vertexShader));
    }

    if (!GL.getShaderParameter(fragmentShader, GL.COMPILE_STATUS)) {
        console.error("ERRO :: A compilação do fragment shader lançou uma excepção!", GL.getShaderInfoLog(fragmentShader));
    }
}


function PrepareProgram() {
    GL.attachShader(program, vertexShader);
    GL.attachShader(program, fragmentShader);

    GL.linkProgram(program);
    if (!GL.getProgramParameter(program, GL.LINK_STATUS)) {
        console.error("ERRO :: O linkProgram lançou uma excepção!", GL.getProgramInfoLog(program));
        return;
    }

    GL.validateProgram(program);
    if (!GL.getProgramParameter(program, GL.VALIDATE_STATUS)) {
        console.error("ERRO :: A validação do programa lançou uma excepção!", GL.getProgramInfoLog(program));
        return;
    }

    GL.useProgram(program);


}

function PrepareTriangleData() {
    vertexPosition = [
    // Em vez de termos 3 valores para as cores RGB vamos ter apenas
    // 2 valores, que são as coordenadas UV
    // X,      Y,      Z,      U,      V
    // Frente
        0,      0,      0,      0,      0,
        0,      1,      0,      0,      1,
        1,      1,      0,      1,      1,
        1,      0,      0,      1,      0,

    // Direita
        1,      0,      0,      0,      0,
        1,      1,      0,      0,      1,
        1,      1,      1,      1,      1,
        1,      0,      1,      1,      0,

    // Trás
        1,      0,      1,      1,      0,
        1,      1,      1,      1,      1,
        0,      1,      1,      0,      1,
        0,      0,      1,      0,      0,

    // Esquerda
        0,      0,      1,      0,      1,
        0,      1,      1,      1,      1,
        0,      1,      0,      1,      0,
        0,      0,      0,      0,      0,

    // Cima
        0,      1,      0,      0,      0,
        0,      1,      1,      0,      1,
        1,      1,      1,      1,      1,
        1,      1,      0,      1,      0,

    // Baixo
        1,      0,      0,      0,      0,
        1,      0,      1,      0,      1,
        0,      0,      1,      0,      1,
        0,      0,      0,      0,      0
    ];

    vertexIndex = [
        //frente
        0, 2, 1,
        0, 3, 2,

        //Direita
        4, 6, 5,
        4, 7, 6,

        //Trás
        8, 10, 9,
        8, 11, 10,

        //Esquerda
        12, 14, 13,
        12, 15, 14,
        
        //Cima
        16, 18, 17,
        16, 19, 18,

        //Baixo
        20, 22, 21,
        20, 23, 22

    ];

    GL.bindBuffer(GL.ARRAY_BUFFER, gpuArrayBuffer);
    GL.bufferData(
        GL.ARRAY_BUFFER,
        new Float32Array(vertexPosition),
        GL.STATIC_DRAW
    );

    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, gpuIndexBuffer);
    GL.bufferData(
        GL.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(vertexIndex),
        GL.STATIC_DRAW
    );

    GL.bindTexture(GL.TEXTURE_2D, boxTexture);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);

    GL.texImage2D(
        GL.TEXTURE_2D,
        0,
        GL.RGBA,
        GL.RGBA,
        GL.UNSIGNED_BYTE,
        document.getElementById('boxImage')
    );
}

function SendDataToShaders() {
    var vertexPositionAttributeLocation = GL.getAttribLocation(program, "vertexPosition");
    // Agora em vez de irmos buscar a localização da variável "vertexColor" vamos buscar
    // a localização da variável "texCoords"
    var texCoordAttributeLocation = GL.getAttribLocation(program, 'texCoords')

    GL.vertexAttribPointer(
        vertexPositionAttributeLocation,
        3,
        GL.FLOAT,
        false,
        // Agora o conjunto apenas tem 5 valores.
        5 * Float32Array.BYTES_PER_ELEMENT,
        0 * Float32Array.BYTES_PER_ELEMENT
    );

    GL.vertexAttribPointer(
        // Mudar a variável de vertexColorAttributeLocation
        // para texCoordAttributeLocation,
        texCoordAttributeLocation,
        // Agora só enviamos um conjunto de 2 valores para a variável
        // texCoords
        2,
        GL.FLOAT,
        false,
        // Agora o conjunto apenas tem 5 valores.
        5 * Float32Array.BYTES_PER_ELEMENT,
        3 * Float32Array.BYTES_PER_ELEMENT
    );

    GL.enableVertexAttribArray(vertexPositionAttributeLocation);
    // Substituímos "vertexColorAttributeLocation" por "texCoordAttributeLocation"
    GL.enableVertexAttribArray(texCoordAttributeLocation);

    finalMatrixLocation = GL.getUniformLocation(program, 'transformationMatrix');
    visualizationMatrixLocation = GL.getUniformLocation(program, 'visualizationMatrix');
    projectionMatrixLocation = GL.getUniformLocation(program, 'projectionMatrix');
    viewportMatrixLocation = GL.getUniformLocation(program, 'viewportMatrix');
}

function loop ()
{
    canvas.width  = window.innerWidth - 15;
    canvas.height = window.innerHeight - 100;
    GL.viewport(0, 0, canvas.width, canvas.height);

    GL.useProgram(program);

    GL.clearColor(0.65, 0.65, 0.65, 1.0);
    GL.clear(GL.DEPTH_BUFFER_BIT | GL.COLOR_BUFFER_BIT);

    var finalMatrix = [
        [1,0,0,0],
        [0,1,0,0],
        [0,0,1,0],
        [0,0,0,1]
    ];

    finalMatrix = math.multiply(CriarMatrizRotacaoY(anguloDeRotacao), finalMatrix);
   
    finalMatrix = math.multiply(finalMatrix, CriarMatrizTranslacao(0,0,1));
   
    var newarray = [];
    
    for (i = 0; i < finalMatrix.length; i++)
    {
        newarray = newarray.concat(finalMatrix[i]);
    }

    var visualizationMatrix = MatrizDeVisualizacao([1,0,0],[0,1,0],[0,0,1],[0,0,-3]);
    var newVisualizationMatrix = [];
    for(i = 0; i < visualizationMatrix.length; i++)
    {
        newVisualizationMatrix = newVisualizationMatrix.concat(visualizationMatrix[i]);
    }

    var projectionMatrix = MatrizPerspetiva(1,4,3,0.1,100);

    var newprojectionMatrix = []
    for(i = 0; i < projectionMatrix.length; i++)
    {
        newprojectionMatrix = newprojectionMatrix.concat(projectionMatrix[i]);
    }

    var viewportMatrix = MatrizViewport(-1,1,-1,1);
    var newviewportMatrix = [];
    for(i = 0; i < viewportMatrix.length; i++)
    {
        newviewportMatrix = newviewportMatrix.concat(viewportMatrix[i]);
    }

    GL.uniformMatrix4fv(finalMatrixLocation, false, newarray);


    GL.uniformMatrix4fv(visualizationMatrixLocation, false, newVisualizationMatrix);
    GL.uniformMatrix4fv(projectionMatrixLocation, false, newprojectionMatrix);
    GL.uniformMatrix4fv(viewportMatrixLocation, false, newviewportMatrix);
    
    GL.drawElements(
        GL.TRIANGLES,
        vertexIndex.length,
        GL.UNSIGNED_SHORT,
        0
    );

    anguloDeRotacao += 1;

    requestAnimationFrame(loop);
}

function Start() {
    console.log('Start function called');
    PrepareCanvas();
    PrepareShaders();
    PrepareProgram();
    PrepareTriangleData();
    SendDataToShaders();
    loop();
}