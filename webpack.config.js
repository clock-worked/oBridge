import path from 'path';
import webpack from 'webpack';

module.exports = {
    entry: './main.ts',
    output: {
        path: path.resolve(__dirname, '.'),
        filename: 'main.js',
    },
    devtool: 'source-map',
    plugins: [
        new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    target: 'node'
}