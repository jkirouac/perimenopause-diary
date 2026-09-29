// Renders public/icon.svg to the PNG sizes phones need for the home screen.
import sharp from 'sharp'
const src = 'public/icon.svg'
for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  await sharp(src).resize(size, size).png().toFile(`public/${name}`)
}
// Maskable: same art with extra padding so Android's round crop keeps the moon whole.
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2c3f66' } })
  .composite([{ input: await sharp(src).resize(360, 360).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile('public/icon-maskable-512.png')
console.log('icons written')
