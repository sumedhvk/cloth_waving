// JavaScript source code
// global variables
var canvas = null;
var gl = null;
var bFullScreen = false;
var canvas_original_width;
var canvas_original_height;

// WebGL related variables
// Shader Program Object
var shaderProgramObject;

// macros for attributes
const webGLMacros = {
    SVK_ATTRIBUTE_POSITION: 0,
    SVK_ATTRIBUTE_COLOR: 1,
    SVK_ATRIBUTE_TEXCOORD: 2,
};

// vao and vbo
var VAO;
var VBO_Position;
var VBO_Texture;
var EBO_Index;

// uniform variables
var modelMatrixUniform;
var viewMatrixUniform;
var projectionMatrixUniform;

// Projection Matrix
var perspectiveProjectionMatrix;

// carpet related variables
//Rows and Columns for carpet
var ROWS = 20;
var COLUMNS = 30;

// texture sampler uniform and texture
var textureSamplerUniform;
var texture_carpet = null;

// wave motion
var wave = 0.0;

// carpet postions, vertices and texcoords
var positions = new Uint16Array(ROWS * COLUMNS * 6);
var vertices = new Float32Array((ROWS + 1) * (COLUMNS + 1) * 3);
var texCoords = new Float32Array((ROWS + 1) * (COLUMNS + 1) * 2);

var requestAnimationFrame = window.requestAnimationFrame ||   // same as swapbuffers
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame;

function main() {
    // code
    // get Canvas
    canvas = document.getElementById("SVK");

    if (!canvas)
        console.log("Obtaining canvas failed!\n");
    else
        console.log("Obtaining canvas success!\n");

    // backup canvas dimensions
    canvas_original_width = canvas.width;
    canvas_original_height = canvas.height;

    // initialize
    initialize();

    // resize warmup
    resize();

    // display
    display();

    // adding mouse and keyboard hangling listners
    window.addEventListener("keydown", keydown, false);
    window.addEventListener("click", mouseDown, false);
    window.addEventListener("resize", resize, false);
}

// fullscreen
function toggleFullscreen() {
    // code
    var fullscreen_element = document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        null;

    if (fullscreen_element == null) // if not fullscreen
    {
        if (canvas.requestFullscreen)
            canvas.requestFullscreen();

        else if (canvas.mozRequestFullScreen)
            canvas.mozRequestFullScreen();

        else if (canvas.webkitRequestFullscreen)
            canvas.webkitRequestFullscreen();

        else if (canvas.msRequestFullscreen)
            canvas.msRequestFullscreen();

        bFullScreen = true;
    }

    else {
        if (document.exitFullscreen)
            document.exitFullscreen();

        else if (document.mozExitFullScreen)
            document.mozExitFullScreen();

        else if (document.webkitExitFullscreen)
            document.webkitExitFullscreen();

        else if (document.msExitFullscreen)
            document.msExitFullscreen();

        bFullScreen = false;
    }
}

function initialize() {
    // code
    // get webgl2 context from canvas
    gl = canvas.getContext("webgl2");

    if (!gl)
        console.log("Obtatining WebGL2 Context failed!\n");
    else
        console.log("Obtaining WebGL2 Context success!\n");

    // set viewport width and height of webgl2 context
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;

    // Vertex Shader
    var vertexShaderSourceCode =
        "#version 300 es" +
        "\n" +
        "in vec4 vPos;" +
        "in vec2 vTexCoord;" +
        "uniform mat4 u_modelMatrix;" +
        "uniform mat4 u_viewMatrix;" +
        "uniform mat4 u_projectionMatrix;" +
        "out vec2 out_texCoord;" +
        "void main(void)" +
        "{" +
        "out_texCoord = vTexCoord;" +
        "gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vPos;" +
        "}";

    var vertexShaderObject = gl.createShader(gl.VERTEX_SHADER);

    gl.shaderSource(vertexShaderObject, vertexShaderSourceCode);

    gl.compileShader(vertexShaderObject);

    if (gl.getShaderParameter(vertexShaderObject, gl.COMPILE_STATUS) == false) {

        var error = gl.getShaderInfoLog(vertexShaderObject);

        if (error.length > 0)
            alert(error);

        uninitialize();
    }

    // Fragment Shader
    var fragmentShaderSourceCode =
        "#version 300 es" +
        "\n" +
        "precision highp float;" +
        "in vec2 out_texCoord;" +
        "uniform sampler2D u_textureSampler;" +
        "out vec4 FragColor;" +
        "void main(void)" +
        "{" +
        "FragColor = texture(u_textureSampler, out_texCoord);" +
        "}";

    var fragmentShaderObject = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(fragmentShaderObject, fragmentShaderSourceCode);

    gl.compileShader(fragmentShaderObject);

    if (gl.getShaderParameter(fragmentShaderObject, gl.COMPILE_STATUS) == false) {

        var error = gl.getShaderInfoLog(fragmentShaderObject);

        if (error.length > 0)
            alert(error);

        uninitialize();
    }

    // Shader Program Object
    shaderProgramObject = gl.createProgram();

    // attach shaders
    gl.attachShader(shaderProgramObject, vertexShaderObject);
    gl.attachShader(shaderProgramObject, fragmentShaderObject);

    // pre-linking step i.e., binding attribute location
    gl.bindAttribLocation(shaderProgramObject, webGLMacros.SVK_ATTRIBUTE_POSITION, "vPos");
    gl.bindAttribLocation(shaderProgramObject, webGLMacros.SVK_ATRIBUTE_TEXCOORD, "vTexCoord");

    // Linking shader program object
    gl.linkProgram(shaderProgramObject);
    // error check for linking
    if (gl.getProgramParameter(shaderProgramObject, gl.LINK_STATUS) == false) {

        var error = gl.getProgramInfoLog(shaderProgramObject);

        if (error.length > 0)
            alert(error);

        uninitialize();
    }

    // Post-linking step i.e., get uniform location
    modelMatrixUniform = gl.getUniformLocation(shaderProgramObject, "u_modelMatrix");
    viewMatrixUniform = gl.getUniformLocation(shaderProgramObject, "u_viewMatrix");
    projectionMatrixUniform = gl.getUniformLocation(shaderProgramObject, "u_projectionMatrix");

    textureSamplerUniform = gl.getUniformLocation(shaderProgramObject, "u_textureSampler");

    // Vertex Data
    indices();
    createTexCoords();

    // VAO and VBO related steps
    // Create and Bind VAO
    VAO = gl.createVertexArray();
    gl.bindVertexArray(VAO);

    // Create and Bind VBO_Position
    VBO_Position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, VBO_Position);
    // send positon data to buffer
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    // vertex attrib pointer
    gl.vertexAttribPointer(webGLMacros.SVK_ATTRIBUTE_POSITION, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(webGLMacros.SVK_ATTRIBUTE_POSITION);
    // Unbind VBO_Position
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Create and Bind VBO_Texture
    VBO_Texture = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, VBO_Texture);
    // send texture data to buffer
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    // vertex attrib pointer
    gl.vertexAttribPointer(webGLMacros.SVK_ATRIBUTE_TEXCOORD, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(webGLMacros.SVK_ATRIBUTE_TEXCOORD);
    // unbind VBO_Color
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Create and Bind
    EBO_Index = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, EBO_Index);
    // send element data to buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    // unbind EBO_Index
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Unbind VAO
    gl.bindVertexArray(null);

    // texture related code
    texture_carpet = gl.createTexture();

    texture_carpet.image = new Image();

    texture_carpet.image.src = "carpet.jpg";

    texture_carpet.image.onload = function ()  // functure or closure or lambda
    {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        gl.bindTexture(gl.TEXTURE_2D, texture_carpet);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texture_carpet.image);

        gl.generateMipmap(gl.TEXTURE_2D);

        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    // enabling texture
    gl.enable(gl.TEXTURE_2D);

    // clear and enable depth
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // projection matrix initialize
    perspectiveProjectionMatrix = mat4.create();

    // clear the screen
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
}

function resize() {
    // code
    if (bFullScreen == true) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    else {
        canvas.width = canvas_original_width;
        canvas.height = canvas_original_height;
    }

    if (canvas.height == 0) {
        canvas.height = 1;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    mat4.perspective(perspectiveProjectionMatrix, 45.0, canvas.width / canvas.height, 0.1, 100.0);
}

function display() {
    // code
    gl.clear(gl.COLOR_BUFFER_BIT || gl.DEPTH_BUFFER_BIT);

    // Use Program
    gl.useProgram(shaderProgramObject);

    // transformations
    let modelmatrix = mat4.create();
    let viewMatrix = mat4.create();
    let translateMatrix = mat4.create();
    let rotateMatrix_X = mat4.create();

    mat4.translate(translateMatrix, translateMatrix, [-6.50, -2.0, -15.0]);
    mat4.rotateX(rotateMatrix_X, rotateMatrix_X, 10.0);
    mat4.multiply(modelmatrix, translateMatrix, rotateMatrix_X);

    // vertices created
    createVertices();

    gl.uniformMatrix4fv(modelMatrixUniform, false, modelmatrix);
    gl.uniformMatrix4fv(viewMatrixUniform, false, viewMatrix);
    gl.uniformMatrix4fv(projectionMatrixUniform, false, perspectiveProjectionMatrix);

    // Bind VAO
    gl.bindVertexArray(VAO);

    // bind VBO_Position
    gl.bindBuffer(gl.ARRAY_BUFFER, VBO_Position);
    // send positon data to buffer
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    // Active texture and Texture binding
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture_carpet);
    gl.uniform1i(textureSamplerUniform, 0);

    // Element Buffer Binding
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, EBO_Index);

    // draw
    gl.drawElements(gl.TRIANGLES, ROWS * COLUMNS * 6, gl.UNSIGNED_SHORT, 0);

    // unbind VBO_Position, texture and Element buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // unbind VAO
    gl.bindVertexArray(null);

    // unuse program
    gl.useProgram(null);

    // waving of carpet
    wave = wave + 0.03;
    if (wave >= 360.0)
        wave = 0.0;

    // double buffering emulation
    requestAnimationFrame(display, canvas);
}

// Index Creation
function indices() {
    let current_row = 0;
    let current_column = 0;
    let rows = ROWS;
    let cols = COLUMNS;
    let counter = 0;

    for (current_row = 0; current_row < rows; current_row++) {
        for (current_column = 0; current_column < cols; current_column++) {
            positions[counter++] = current_row * (cols + 1) + current_column;
            positions[counter++] = (current_row + 1) * (cols + 1) + current_column;
            positions[counter++] = (current_row + 1) * (cols + 1) + (current_column + 1);

            positions[counter++] = current_row * (cols + 1) + current_column;
            positions[counter++] = current_row * (cols + 1) + (current_column + 1);
            positions[counter++] = (current_row + 1) * (cols + 1) + (current_column + 1);
        }
    }
}

// Vertex Creation
function createVertices() {

    let x_plane = 0.0;
    let z_plane = 0.0;
    let counter = 0;

    for (let i = 0; i <= ROWS; i++) {
        for (let j = 0; j <= COLUMNS; j++) {
            vertices[counter++] = x_plane;
            vertices[counter++] = 0.2 * (Math.sin(x_plane - wave));
            vertices[counter++] = z_plane;
            x_plane += 0.5;
        }
        x_plane = 0.0;
        z_plane += 0.5;
    }
}

// TexCoord Creation
function createTexCoords() {
    let row = ROWS + 1;
    let cols = COLUMNS + 1;
    let current_row = 0;
    let current_column = 0;
    let s_texcoord = 0.0;
    let t_texcoord = 1.0;
    let counter = 0;


    for (current_row = 0; current_row < row; current_row++) {
        for (current_column = 0; current_column < cols; current_column++) {
            texCoords[counter++] = s_texcoord;
            texCoords[counter++] = t_texcoord;
            s_texcoord += (1.0 / (cols - 1.0));
        }
        s_texcoord = 0.0;
        t_texcoord -= (1.0 / (row - 1));
    }
}

// keyboard event listner
function keydown(event) {
    // code
    switch (event.keyCode) {
        case 69:
            uninitialize();
            window.close(); // not supported by all browsers
            break;
        case 70:
            toggleFullscreen();
            break;
    }
}

// mouse event listner
function mouseDown() {
    // code

}

// Uninitialize
function uninitialize() {
    // code
    if (EBO_Index) {
        gl.deleteBuffer(EBO_Index);
        EBO_Index = null;
    }

    if (VBO_Texture) {
        gl.deleteBuffer(VBO_Texture);
        VBO_Texture = null;
    }

    if (VBO_Position) {
        gl.deleteBuffer(VBO_Position);
        VBO_Position = null;
    }

    if (VAO) {
        gl.deleteVertexArray(VAO);
        VAO = null;
    }

    // Shader Program Object Uninitialize
    if (shaderProgramObject) {

        gl.useProgram(shaderProgramObject);

        let shaderObjects = gl.getAttachedShaders(shaderProgramObject);

        for (let i = 0; i < shaderObjects.length; ++i) {
            gl.detachShader(shaderProgramObject, shaderObjects[i]);

            gl.deleteShader(shaderObjects[i]);

            shaderObjects[i] = null;
        }

        gl.useProgram(null);

        gl.deleteProgram(shaderProgramObject);

        shaderProgramObject = null;
    }
}
