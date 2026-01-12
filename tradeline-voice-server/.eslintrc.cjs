module.exports = {
    env: {
        node: true,
        es2022: true,
    },
    extends: 'airbnb-base',
    rules: {
        'no-console': 'off', // Allowed for server logs
        'consistent-return': 'error',
        'import/no-extraneous-dependencies': 'off',
        'class-methods-use-this': 'off',
    },
};
