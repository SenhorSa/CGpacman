// Código correspondente ao vertex shader
var codigoVertexShader = [
    'precision mediump float;', // Indica qual a precisão do tipo float

    'attribute vec3 vertexPosition;', // Variável read-only do tipo vec3 que indicará a posição de um vértice

    'attribute vec2 texCoords;', // Variável read-only do tipo vec2 que indicará as coordenadas de textura de um vértice
    'varying vec2 fragtexCoords;', // Variável que serve de interface entre o vertex shader e o fragment shader

    //Matriz 4x4 que indica quais as transformações que devem ser feitas
    'uniform mat4 transformationMatrix;',
    'uniform mat4 visualizationMatrix;',
    'uniform mat4 projectionMatrix;',
    'uniform mat4 viewportMatrix;',
    
    'void main(){',
    '   fragtexCoords = texCoords;', // Dizemos ao fragment shader quais as coordenadas de textura do vértice
    '   gl_Position = vec4(vertexPosition, 1.0) * transformationMatrix * visualizationMatrix * projectionMatrix * viewportMatrix;', // gl_Position é uma variável própria do Shader que indica a posição do vértice
    '}', 
].join('\n');

// Código correspondente ao fragment shader
var codigoFragmentShader = [
    'precision mediump float;', // Indica qual a precisão do tipo float
    'varying vec2 fragtexCoords;', // Variável que serve de interface entre o vertex shader e o fragment shader
    'uniform sampler2D sampler;', // Variável que indica a textura a ser aplicada ao objeto
    'void main(){',
    '   gl_FragColor = texture2D(sampler, fragtexCoords);', // gl_FragColor é uma variável própria do Shader que indica qual a cor do vértice
    '}',
].join('\n');
