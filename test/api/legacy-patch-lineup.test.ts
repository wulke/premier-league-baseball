import { Endpoints } from '../../src/api/endpoints';
import { router } from '../../src/api/router';

// @spec LEDIT-001
describe('active lineup write routing', () => {
  // @spec LEDIT-001
  it('registers only the managed wholesale PUT write for the lineup path', () => {
    const routes = router.stack.filter((layer: any) => layer.route?.path === Endpoints.SaveTeamLineup);

    expect(routes.some((layer: any) => layer.route.methods.patch)).toBe(false);
    expect(routes.some((layer: any) => layer.route.methods.put)).toBe(true);
  });
});
