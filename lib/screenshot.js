import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

export async function captureScreenshot(
    texture,
    geometry,
    scale = 1,
    cursor = null
) {
    const stream = Gio.MemoryOutputStream.new_resizable();
    const [x, y, w, h] = geometry ?? [0, 0, -1, -1];
    if (cursor === null) {
        cursor = { texture: null, x: 0, y: 0, scale: 1 };
    }

    await (Shell.Screenshot).composite_to_stream(
        texture,
        x,
        y,
        w,
        h,
        scale,
        cursor.texture,
        cursor.x,
        cursor.y,
        cursor.scale,
        stream,
    );

    stream.close(null);
    return stream.steal_as_bytes();
}