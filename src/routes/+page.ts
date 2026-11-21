import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Links shared before the city page had its own route still open the city. */
export const load: PageLoad = ({ url }) => {
  if (url.searchParams.has('city')) redirect(308, `/city${url.search}`);
};
