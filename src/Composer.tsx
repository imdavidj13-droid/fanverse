import type { Profile } from './model';
export function Avatar({ profile }: {
    profile: Profile;
}) { return <div className="cloud-avatar">{profile.avatar ? <img src={profile.avatar} alt=""/> : profile.name.slice(0, 1)}</div>; }
export async function readImage(file: File): Promise<string> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10000000)
        throw Error('Choose a PNG, JPEG or WebP image smaller than 10 MB.');
    const bitmap = await createImageBitmap(file), canvas = document.createElement('canvas'), scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let value = canvas.toDataURL('image/jpeg', .8);
    if (value.length > 550000)
        value = canvas.toDataURL('image/jpeg', .45);
    if (value.length > 550000)
        throw Error('Choose a smaller image.');
    return value;
}
