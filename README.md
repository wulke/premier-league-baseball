# premier-league-baseball

## Local Build

### Non-Docker build
* Build the project: `npm run build`
* Run the project: `npm run start`
* Open browser and load `localhost:${PORT}` (from .env)

### Docker build
* Build the project: `docker build -t ${image.name} .`
* Run the project: `docker run -p ${docker.port}:${express.prt} ${image.name}`
* Open browser and load `localhost:${docker.port}`

## References
* https://preactjs.com/guide/v10/getting-started
* https://www.radix-ui.com/primitives/docs/overview/introduction
* https://stitches.dev
* https://parceljs.org/docs

## Dependencies
* [dotenv](https://github.com/motdotla/dotenv)
* [preact](https://preactjs.com/guide/v10/refs)
* [preact-router](https://github.com/preactjs/preact-router)
* [parcel](https://parceljs.org/getting-started/webapp/)
* [radix-ui](https://www.radix-ui.com/primitives/docs/overview/introduction)
* [react-hook-form](https://react-hook-form.com/get-started#integratingwithUIlibraries)
* [sequelize](https://sequelize.org/docs/v6/getting-started/)
* [stithces](https://stitches.dev/docs/styling)