import fs from 'node:fs/promises';
import path from 'node:path';

const SWAGGER_DIR = path.join(__dirname, '../public/swagger');

async function generateSwaggerUI() {
  console.log('Generating Swagger UI...');

  try {
    // Create directory if it doesn't exist
    await fs.mkdir(SWAGGER_DIR, { recursive: true });

    // Read swagger.json
    await fs.readFile(
      path.join(__dirname, '../generated/swagger.json'),
      'utf-8',
    );

    // Create HTML file with Swagger UI
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Git Dungeon Backend API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.29.5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.29.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.29.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/swagger.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>
    `;

    // Write HTML file
    await fs.writeFile(path.join(SWAGGER_DIR, 'index.html'), htmlContent);

    // Copy swagger.json to public directory
    await fs.copyFile(
      path.join(__dirname, '../generated/swagger.json'),
      path.join(SWAGGER_DIR, 'swagger.json'),
    );

    console.log('✅ Swagger UI generated successfully!');
    console.log('📄 Open: http://localhost:3002/swagger');
  } catch (error) {
    console.error('Error generating Swagger UI:', error);
    process.exit(1);
  }
}

generateSwaggerUI();
