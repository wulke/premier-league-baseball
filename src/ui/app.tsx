// @spec RLDRUI-001,RLDRUI-006
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import routes from './routes';

const router = createBrowserRouter(routes);

const root = createRoot(document.getElementById('app')!);
root.render(<RouterProvider router={router} />);
