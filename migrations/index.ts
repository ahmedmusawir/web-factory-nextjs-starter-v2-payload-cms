import * as migration_20261114_040213_foundation from './20261114_040213_foundation';
import * as migration_20261114_072417_website from './20261114_072417_website';
import * as migration_20261115_065237_wordpress_blog from './20261115_065237_wordpress_blog';

export const migrations = [
  {
    up: migration_20261114_040213_foundation.up,
    down: migration_20261114_040213_foundation.down,
    name: '20261114_040213_foundation',
  },
  {
    up: migration_20261114_072417_website.up,
    down: migration_20261114_072417_website.down,
    name: '20261114_072417_website',
  },
  {
    up: migration_20261115_065237_wordpress_blog.up,
    down: migration_20261115_065237_wordpress_blog.down,
    name: '20261115_065237_wordpress_blog'
  },
];
