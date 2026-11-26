/** Division photographs (public records) used for screen-only page banners. Never used on printed or exported forms. */
export type PhotoKey =
  | 'graduation-oath'
  | 'cruiser-skyline'
  | 'cruiser-dusk'
  | 'officers-portrait'
  | 'recruit-run'
  | 'new-officers'
  | 'class-seated'
  | 'cruiser-lights';

type Photo = { file: string; alt: string; position: string };

const PHOTOS: Record<PhotoKey, Photo> = {
  'graduation-oath': { file: 'graduation-oath.webp', alt: 'Columbus police recruits taking the oath at graduation', position: '50% 35%' },
  'cruiser-skyline': { file: 'cruiser-skyline.webp', alt: 'Columbus police cruiser in front of the downtown skyline', position: '50% 60%' },
  'cruiser-dusk': { file: 'cruiser-dusk.webp', alt: 'Columbus police cruiser at dusk', position: '50% 55%' },
  'officers-portrait': { file: 'officers-portrait.webp', alt: 'Columbus police officers in dress uniform', position: '50% 30%' },
  'recruit-run': { file: 'recruit-run.webp', alt: 'Columbus police recruits on a training run', position: '50% 40%' },
  'new-officers': { file: 'new-officers.webp', alt: 'New Columbus police officers in formation', position: '50% 30%' },
  'class-seated': { file: 'class-seated.webp', alt: 'Columbus police recruit class seated in uniform', position: '50% 40%' },
  'cruiser-lights': { file: 'cruiser-lights.webp', alt: 'Police cruiser light bar at night', position: '50% 55%' },
};

export function photo(key: PhotoKey) {
  const p = PHOTOS[key];
  return { src: `${import.meta.env.BASE_URL}photos/${p.file}`, alt: p.alt, position: p.position };
}

/** Sign-in slideshow order. */
export const SIGN_IN_PHOTOS: PhotoKey[] = ['graduation-oath', 'new-officers', 'recruit-run', 'class-seated'];
